// app/api/rooms/[roomId]/leave/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  let userId: string;
  let roomId: string;

  try {
    // 1. Authentication check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error('[Leave Room] Auth error:', sessionError?.message || 'No session');
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    userId = session.user.id;

    // 2. Validate room ID
    roomId = params.roomId;
    if (!roomId || !UUID_REGEX.test(roomId)) {
      console.error('[Leave Room] Invalid room ID:', roomId);
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
      console.error('[Leave Room] Room fetch error:', roomError?.message || 'Not found');
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
          code: "ROOM_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    // 4. Check membership status
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("id, status, role")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      console.error('[Leave Room] Membership check failed:', membershipError?.message || 'No membership');
      return NextResponse.json(
        {
          success: false,
          error: "You're not a member of this room",
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
        console.error('[Leave Room] Member count error:', countError.message);
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

      // If creator is the only member, proceed with room deletion
      const { error: deleteError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (deleteError) {
        console.error('[Leave Room] Room deletion error:', deleteError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to delete empty room",
            code: "ROOM_DELETION_FAILED"
          },
          { status: 500 }
        );
      }

      // Create special notification
      await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: "room_deleted",
          room_id: roomId,
          message: `You deleted the room "${room.name}"`,
          status: "unread"
        });

      return NextResponse.json({
        success: true,
        message: `Room "${room.name}" deleted as you were the last member`,
        roomDeleted: true,
        hasOtherRooms: false
      });
    }

    // 6. Regular member leaving process
    const { error: leaveError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (leaveError) {
      console.error('[Leave Room] Leave error:', leaveError.message);
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
      .from("room_members")
      .select("room_id, rooms(name)")
      .eq("user_id", userId)
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
      roomLeft: room,
      hasOtherRooms,
      defaultRoom: hasOtherRooms ? {
        id: defaultRoom?.room_id,
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