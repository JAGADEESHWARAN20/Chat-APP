// /api/rooms/[roomId]/join/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const roomId = context.params.roomId;
  console.log("[join] Room ID received:", roomId);

  if (!roomId || !UUID_REGEX.test(roomId)) {
    return NextResponse.json(
      { success: false, error: "Invalid room ID", code: "INVALID_ROOM_ID" },
      { status: 400 }
    );
  }

    // 2. Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error("[join] Authentication error:", sessionError?.message || "No session");
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const userId = session.user.id;
    console.log("[join] Authenticated user:", userId);

    // 3. Fetch room details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      console.error("[join] Room fetch error:", roomError?.message || "Room not found");
      return NextResponse.json(
        { success: false, error: "Room not found", code: "ROOM_NOT_FOUND" },
        { status: 404 }
      );
    }
    console.log("[join] Room details:", room);

    // 4. Check existing membership/participation
    const { data: existingMember } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: existingParticipant } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember?.status === "accepted" || existingParticipant?.status === "accepted") {
      console.log("[join] User already a member of room:", roomId);
      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Already a member",
        roomJoined: room,
      });
    }

    if (existingParticipant?.status === "pending") {
      console.log("[join] Join request already pending for room:", roomId);
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // 5. Fetch sender profile for notifications
    const { data: senderProfile, error: profileError } = await supabase
      .from("users")
      .select("display_name, username")
      .eq("id", userId)
      .single();
    if (profileError) {
      console.error("[join] Sender profile fetch error:", profileError.message);
    }
    const senderName = senderProfile?.display_name || senderProfile?.username || session.user.email || "A user";
    const now = new Date().toISOString();

    const isPrivate = room.is_private;
    const table = isPrivate ? "room_participants" : "room_members";
    const finalStatus = isPrivate ? "pending" : "accepted";

    // 6. Insert into appropriate table
    const { error: insertError } = await supabase
      .from(table)
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          status: finalStatus,
          joined_at: now,
          active: true,
          updated_at: now,
        },
        { onConflict: isPrivate ? "room_participants_room_id_user_id_key" : "room_members_room_id_user_id_unique" }
      );

    if (insertError) {
      console.error(`[join] ${table} insert error:`, insertError.message);
      return NextResponse.json(
        { success: false, error: "Failed to join room", code: "JOIN_FAILED", details: insertError.message },
        { status: 400 }
      );
    }

    // 7. Handle notifications
    if (isPrivate) {
      // Notify room owner
      if (room.created_by) {
        const { error: ownerNotifError } = await supabase.from("notifications").insert({
          user_id: room.created_by,
          sender_id: userId,
          room_id: roomId,
          type: "join_request",
          message: `${senderName} requested to join "${room.name}"`,
          status: "unread",
          created_at: now,
        });
        if (ownerNotifError) {
          console.error("[join] Owner notification error:", ownerNotifError.message);
        }
      }

      // Notify user
      const { error: userNotifError } = await supabase.from("notifications").insert({
        user_id: userId,
        sender_id: userId,
        room_id: roomId,
        type: "join_request_sent",
        message: `You requested to join "${room.name}"`,
        status: "unread",
        created_at: now,
      });
      if (userNotifError) {
        console.error("[join] User notification error:", userNotifError.message);
      }

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });
    } else {
      // Notify room owner
      if (room.created_by) {
        const { error: ownerNotifError } = await supabase.from("notifications").insert({
          user_id: room.created_by,
          sender_id: userId,
          room_id: roomId,
          type: "user_joined",
          message: `${senderName} joined "${room.name}"`,
          status: "unread",
          created_at: now,
        });
        if (ownerNotifError) {
          console.error("[join] Owner notification error:", ownerNotifError.message);
        }
      }

      // Notify user
      const { error: userNotifError } = await supabase.from("notifications").insert({
        user_id: userId,
        sender_id: userId,
        room_id: roomId,
        type: "room_joined",
        message: `You joined "${room.name}"`,
        status: "unread",
        created_at: now,
      });
      if (userNotifError) {
        console.error("[join] User notification error:", userNotifError.message);
      }

      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Joined room successfully",
        roomJoined: room,
      });
    }
  } catch (err: any) {
    console.error("[join] Server error:", err.message, err.stack);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR", details: err.message },
      { status: 500 }
    );
  }
}