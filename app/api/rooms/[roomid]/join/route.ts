// /api/rooms/[roomId]/join/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        { success: false, error: "Room not found", code: "ROOM_NOT_FOUND", details: roomError?.message },
        { status: 404 }
      );
    }

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
      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Already a member",
        roomJoined: room,
      });
    }

    if (existingMember?.status === "pending" || existingParticipant?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // 5. Fetch sender profile
    const { data: senderProfile } = await supabase
      .from("users") // Changed to "users" to match schema
      .select("display_name, username")
      .eq("id", userId)
      .single();
    const senderName = senderProfile?.display_name || senderProfile?.username || session.user.email || "A user";

    const isPrivate = room.is_private;
    const now = new Date().toISOString();

    if (isPrivate) {
      // 6. Private room: request approval
      if (!room.created_by) {
        return NextResponse.json(
          { success: false, error: "Room owner information is missing", code: "ROOM_OWNER_MISSING" },
          { status: 500 }
        );
      }

      const { error: participantError } = await supabase
        .from("room_participants")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "pending",
            created_at: now,
            joined_at: now,
            active: true,
          },
          { onConflict: "room_participants_room_id_user_id_unique" }
        );

      if (participantError) {
        console.error("[join] Participant insert error:", participantError);
        return NextResponse.json(
          {
            success: false,
            error: "Could not request join",
            code: "PARTICIPANT_INSERT_FAILED",
            details: participantError.message,
          },
          { status: 500 }
        );
      }

      // 7. Notify room owner
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
        console.error("[join] Owner notification insert error:", ownerNotifError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to send notification to room owner",
            code: "NOTIFICATION_FAILED",
            details: ownerNotifError.message,
          },
          { status: 500 }
        );
      }

      // 8. Notify user
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
        console.error("[join] User notification insert error:", userNotifError);
      }

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });
    } else {
      // 9. Public room: auto-accept
      const { error: participantError } = await supabase
        .from("room_participants")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "accepted",
            created_at: now,
            joined_at: now,
            active: true,
          },
          { onConflict: "room_participants_room_id_user_id_unique" }
        );

      const { error: memberError } = await supabase
        .from("room_members")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "accepted",
            joined_at: now,
            active: true,
            updated_at: now,
          },
          { onConflict: "room_members_room_id_user_id_unique" }
        );

      if (participantError || memberError) {
        console.error("[join] Insert error:", participantError || memberError);
        return NextResponse.json(
          {
            success: false,
            error: "Join failed",
            code: "JOIN_FAILED",
            details: (participantError || memberError)?.message,
          },
          { status: 500 }
        );
      }

      // 10. Notify room owner
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
          console.error("[join] Owner notification insert error:", ownerNotifError);
        }
      }

      // 11. Notify user
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
        console.error("[join] User notification insert error:", userNotifError);
      }

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
      {
        success: false,
        error: err.message || "Internal server error",
        code: "INTERNAL_ERROR",
        details: err.message,
      },
      { status: 500 }
    );
  }
}