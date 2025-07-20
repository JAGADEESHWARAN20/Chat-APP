import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase"; // Assuming you have this type definition

// Force dynamic rendering for this route as it accesses cookies
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies }); // Use Database type
    const { roomId } = await req.json();

    // Validate session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json(
        { error: "Invalid room ID", code: "INVALID_ROOM_ID" },
        { status: 400 }
      );
    }

    // Fetch room details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Room not found", code: "ROOM_NOT_FOUND" },
        { status: 404 }
      );
    }

    const isRoomOwner = room.created_by === userId;

    // --- Core Logic for Joining/Switching ---

    // 1. Deactivate all of the user's current active rooms in room_members
    const { error: deactivateError } = await supabase
      .from("room_members")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("active", true); // Only deactivate currently active ones

    if (deactivateError) {
      console.error("Error deactivating previous rooms:", deactivateError.message);
      // Continue, as this might not be critical if no active rooms existed
    }

    // 2. Check if the user is already an accepted member or participant
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    const { data: existingParticipant, error: participantCheckError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (membershipCheckError && membershipCheckError.code !== "PGRST116") { // PGRST116 means no rows found
      console.error("Error checking existing membership:", membershipCheckError.message);
      return NextResponse.json({ error: "Failed to check membership", code: "MEMBERSHIP_CHECK_FAILED" }, { status: 500 });
    }
    if (participantCheckError && participantCheckError.code !== "PGRST116") {
      console.error("Error checking existing participant status:", participantCheckError.message);
      return NextResponse.json({ error: "Failed to check participant status", code: "PARTICIPANT_CHECK_FAILED" }, { status: 500 });
    }

    const isMemberAccepted = existingMembership?.status === "accepted";
    const isParticipantAccepted = existingParticipant?.status === "accepted";
    const isParticipantPending = existingParticipant?.status === "pending";

    // Scenario A: User is already an accepted member or participant, or is the owner, or room is public
    if (isMemberAccepted || isParticipantAccepted || isRoomOwner || !room.is_private) {
      // Upsert (insert or update) into room_members to ensure they are an accepted, active member
      const { error: upsertMemberError } = await supabase
        .from("room_members")
        .upsert(
          { room_id: roomId, user_id: userId, status: "accepted", active: true, updated_at: new Date().toISOString() },
          { onConflict: "room_id,user_id" } // Update if exists, insert if not
        );

      if (upsertMemberError) {
        console.error("Error upserting room member:", upsertMemberError.message);
        return NextResponse.json({ error: "Failed to update membership", code: "MEMBER_UPSERT_FAILED" }, { status: 500 });
      }

      // If they were a pending participant, update their status to accepted in room_participants as well
      if (isParticipantPending) {
         await supabase
          .from("room_participants")
          .update({ status: "accepted" })
          .eq("room_id", roomId)
          .eq("user_id", userId);
          // No need to throw error if this fails, it's a secondary update
      }

      return NextResponse.json({
        success: true,
        message: `Switched to room ${room.name}`,
        status: "accepted", // Explicitly return accepted status
      });
    }

    // Scenario B: Room is private, and user is not an accepted member/participant/owner
    // Check if there's already a pending request
    if (isParticipantPending) {
      return NextResponse.json({
        success: false,
        message: "Your request to join this room is still pending",
        status: "pending",
      });
    }

    // If no existing pending request, create one
    const { error: insertParticipantError } = await supabase
      .from("room_participants")
      .insert({ room_id: roomId, user_id: userId, status: "pending", created_at: new Date().toISOString() });

    if (insertParticipantError) {
      console.error("Error inserting pending participant:", insertParticipantError.message);
      return NextResponse.json(
        { error: "Failed to request switch", code: "PARTICIPANT_INSERT_FAILED" },
        { status: 500 }
      );
    }

    // Send notification to room owner
    // FIX: Ensure room.created_by is not null before using it.
    // If room.created_by can be null, you need to decide how to handle the notification.
    // For now, we'll check for null and return an error if it's critical,
    // or skip notification if it's acceptable.
    if (!room.created_by) {
        console.warn(`Room ${room.id} has no creator. Skipping notification.`);
        return NextResponse.json({
            success: false,
            message: "Join request sent, but room owner could not be notified.",
            status: "pending",
        });
    }

    const { error: notifyError } = await supabase
      .from("notifications")
      .insert({
        user_id: room.created_by, // This is now guaranteed to be a string
        type: "room_switch", // Consider renaming to 'room_join_request' for clarity
        room_id: roomId,
        sender_id: userId,
        message: `User ${session.user.email} requests to join room "${room.name}"`,
        status: "unread",
        join_status: "pending",
      });

    if (notifyError) {
      console.error("Error notifying room owner:", notifyError.message);
      // This error is less critical than failing the join request itself, so log and proceed
    }

    return NextResponse.json({
      success: false, // Indicate that the action is not immediately successful (it's pending)
      message: "Join request sent to room owner for approval",
      status: "pending",
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Switch Room API Error]:", message);
    return NextResponse.json({ error: "Failed to switch room", details: message }, { status: 500 });
  }
}
