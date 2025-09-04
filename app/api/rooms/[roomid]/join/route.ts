// /api/rooms/[roomId]/join/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Force dynamic rendering to ensure up-to-date data
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId?: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const roomId = params.roomId;

    // 1. Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // 2. Validate room ID
    if (!roomId || !UUID_REGEX.test(roomId)) {
      return NextResponse.json(
        { success: false, error: "Invalid room ID", code: "INVALID_ROOM_ID" },
        { status: 400 }
      );
    }

    // 3. Fetch room details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { success: false, error: "Room not found", code: "ROOM_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 4. Check existing membership/participation status
    const { data: existingStatus } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingStatus?.status === "accepted") {
      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Already a member",
        roomJoined: room,
      });
    }

    if (existingStatus?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // 5. Fetch sender profile for notifications
    const { data: senderProfile } = await supabase
      .from("users")
      .select("display_name, username")
      .eq("id", userId)
      .single();
    const senderName = senderProfile?.display_name || senderProfile?.username || session.user.email || "A user";
    const now = new Date().toISOString();

    const isPrivate = room.is_private;
    const finalStatus = isPrivate ? "pending" : "accepted";

    // 6. Use a transaction to ensure atomicity
    const { error: transactionError } = await supabase.from("room_members").upsert(
      {
        room_id: roomId,
        user_id: userId,
        status: finalStatus,
        joined_at: now,
        active: true,
        updated_at: now,
      },
      { onConflict: "room_members_room_id_user_id_unique" }
    );

    if (transactionError) {
      console.error("[join] Membership/Participant insert error:", transactionError);
      return NextResponse.json(
        { success: false, error: "Failed to join room", code: "JOIN_FAILED", details: transactionError.message },
        { status: 500 }
      );
    }

    // 7. Handle notifications based on room type
    if (isPrivate) {
      // Notify room owner of pending request
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
        if (ownerNotifError) console.error("[join] Owner notification error:", ownerNotifError);
      }

      // Notify user that their request has been sent
      const { error: userNotifError } = await supabase.from("notifications").insert({
        user_id: userId,
        sender_id: userId,
        room_id: roomId,
        type: "join_request_sent",
        message: `You requested to join "${room.name}"`,
        status: "unread",
        created_at: now,
      });
      if (userNotifError) console.error("[join] User notification error:", userNotifError);

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });

    } else { // Public room: auto-accept
      // Notify room owner that a user joined
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
        if (ownerNotifError) console.error("[join] Owner notification error:", ownerNotifError);
      }

      // Notify user that they have joined
      const { error: userNotifError } = await supabase.from("notifications").insert({
        user_id: userId,
        sender_id: userId,
        room_id: roomId,
        type: "room_joined",
        message: `You joined "${room.name}"`,
        status: "unread",
        created_at: now,
      });
      if (userNotifError) console.error("[join] User notification error:", userNotifError);

      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Joined room successfully",
        roomJoined: room,
      });
    }
  } catch (err: any) {
    console.error("[join] Server error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR", details: err.message },
      { status: 500 }
    );
  }
}