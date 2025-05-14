import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    // 1. Authentication check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const roomId = params.roomId;

    // 2. Validate room ID
    if (!roomId || !UUID_REGEX.test(roomId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid room identifier",
          code: "INVALID_ROOM_ID"
        },
        { status: 400 }
      );
    }

    // 3. Verify room exists and get details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
          code: "ROOM_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    // 4. Check membership status in both tables
    const { data: participant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    const { data: member, error: memberError } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if ((participantError && participantError.code !== "PGRST116") ||
      (memberError && memberError.code !== "PGRST116")) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify membership",
          code: "MEMBERSHIP_CHECK_FAILED"
        },
        { status: 500 }
      );
    }

    if ((!participant || participant.status !== "accepted") && !member) {
      return NextResponse.json(
        {
          success: false,
          error: "You're not an active member of this room",
          code: "NOT_A_MEMBER"
        },
        { status: 403 }
      );
    }

    // 5. Special handling for room creator
    if (room.created_by === userId) {
      const { count: memberCount, error: countError } = await supabase
        .from("room_members")
        .select("*", { count: "exact" })
        .eq("room_id", roomId);

      if (countError) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to verify room members",
            code: "MEMBER_COUNT_ERROR"
          },
          { status: 500 }
        );
      }

      if (memberCount && memberCount > 1) {
        return NextResponse.json(
          {
            success: false,
            error: "As room creator, you must transfer ownership before leaving",
            code: "CREATOR_CANNOT_LEAVE",
            solution: "Please assign a new owner first"
          },
          { status: 400 }
        );
      }

      // Begin transaction for creator leaving (last member)
      const { error: deleteError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (deleteError) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to delete empty room",
            code: "ROOM_DELETION_FAILED"
          },
          { status: 500 }
        );
      }
    }

    // 6. Remove from both tables (transaction would be better here)
    const { error: leaveParticipantError } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    const { error: leaveMemberError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (leaveParticipantError || leaveMemberError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to leave room",
          code: "LEAVE_FAILED"
        },
        { status: 500 }
      );
    }

    // 7. Check for other available rooms
    const { data: otherRooms } = await supabase
      .from("room_participants")
      .select("room_id, rooms(name)")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    const hasOtherRooms = otherRooms && otherRooms.length > 0;
    const defaultRoom = otherRooms?.[0];

    // 8. Create notification
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: "room_left",
        room_id: roomId,
        sender_id: userId,
        message: `You left the room "${room.name}"`,
        status: "unread"
      });

    // 9. Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully left "${room.name}"`,
      roomLeft: {
        id: room.id,
        name: room.name
      },
      hasOtherRooms,
      defaultRoom: hasOtherRooms ? {
        id: defaultRoom?.room_id,
        name: defaultRoom?.rooms?.name
      } : null
    });

  } catch (error) {
    console.error('[Leave Room] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}