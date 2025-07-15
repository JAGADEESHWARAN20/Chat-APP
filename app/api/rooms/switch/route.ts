import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
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

    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json(
        { error: "Invalid room ID", code: "INVALID_ROOM_ID" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

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

    // Check membership
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("status, active")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    const isMemberAccepted = membership?.status === "accepted";

    const deactivateAndActivateRoom = async () => {
      const timestamp = new Date().toISOString();

      const { error: deactivateError } = await supabase
        .from("room_members")
        .update({ active: false, updated_at: timestamp })
        .eq("user_id", userId);
      if (deactivateError) throw new Error(deactivateError.message);

      const { error: activateError } = await supabase
        .from("room_members")
        .update({ active: true, updated_at: timestamp })
        .eq("room_id", roomId)
        .eq("user_id", userId);
      if (activateError) throw new Error(activateError.message);

      const { data: activeRooms, error: activeRoomError } = await supabase
        .from("room_members")
        .select("id")
        .eq("user_id", userId)
        .eq("active", true);

      if (activeRoomError || activeRooms?.length !== 1) {
        throw new Error("Failed to verify active room");
      }
    };

    // If already an accepted member, just switch
    if (isMemberAccepted) {
      await deactivateAndActivateRoom();
      return NextResponse.json({
        success: true,
        message: `Switched to room ${room.name}`,
      });
    }

    // Check participant status
    const { data: participant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (participantError && participantError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to check participant status", code: "PARTICIPATION_CHECK_FAILED" },
        { status: 500 }
      );
    }

    if (participant?.status === "pending") {
      return NextResponse.json({
        success: false,
        message: "Your request to switch to this room is still pending",
        status: "pending",
      });
    }

    if (participant?.status === "accepted") {
      // Sync into room_members
      const { error: insertMemberError } = await supabase
        .from("room_members")
        .insert({ room_id: roomId, user_id: userId, status: "accepted", active: false });
      if (insertMemberError) {
        return NextResponse.json(
          { error: "Failed to sync room membership", code: "MEMBER_ADD_FAILED" },
          { status: 500 }
        );
      }

      await deactivateAndActivateRoom();
      return NextResponse.json({
        success: true,
        message: `Switched to room ${room.name}`,
      });
    }

    // If user is owner, insert directly
    if (isRoomOwner) {
      const timestamp = new Date().toISOString();
      const { error: ownerInsertError } = await supabase
        .from("room_members")
        .insert({ room_id: roomId, user_id: userId, status: "accepted", active: true });

      if (ownerInsertError) {
        return NextResponse.json(
          { error: "Failed to add owner to room", code: "OWNER_ADD_FAILED" },
          { status: 500 }
        );
      }

      // Deactivate other rooms
      const { error: deactivateOthersError } = await supabase
        .from("room_members")
        .update({ active: false, updated_at: timestamp })
        .eq("user_id", userId)
        .neq("room_id", roomId);

      if (deactivateOthersError) {
        return NextResponse.json(
          { error: "Failed to deactivate other rooms", code: "DEACTIVATE_FAILED" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Switched to room ${room.name}`,
      });
    }

    // Create pending participant request
    const { error: insertParticipantError } = await supabase
      .from("room_participants")
      .insert({ room_id: roomId, user_id: userId, status: "pending" });

    if (insertParticipantError) {
      return NextResponse.json(
        { error: "Failed to request switch", code: "PARTICIPANT_INSERT_FAILED" },
        { status: 500 }
      );
    }

    // Send notification
    const { error: notifyError } = await supabase
      .from("notifications")
      .insert({
        user_id: room.created_by,
        type: "room_switch",
        room_id: roomId,
        sender_id: userId,
        message: `User ${session.user.email} requests to switch to room "${room.name}"`,
        status: "unread",
        join_status: "pending",
      });

    if (notifyError) {
      return NextResponse.json(
        { error: "Failed to notify room owner", code: "NOTIFICATION_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: false,
      message: "Switch request sent to room owner for approval",
      status: "pending",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Switch Room API Error]:", message);
    return NextResponse.json({ error: "Failed to switch room", details: message }, { status: 500 });
  }
}
