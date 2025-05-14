// app/api/rooms/[roomId]/leave/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Verify user authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('Authentication error:', sessionError?.message || 'No session found');
      return NextResponse.json(
        { error: "You must be logged in to leave a room" },
        { status: 401 }
      );
    }

    // 2. Extract and validate room ID
    const roomId = params.roomId;

    if (!roomId) {
      console.error('No roomId provided in route parameters');
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // Decode URI component in case it was encoded
    const decodedRoomId = decodeURIComponent(roomId);

    if (!UUID_REGEX.test(decodedRoomId)) {
      console.error('Invalid room ID format:', decodedRoomId);
      return NextResponse.json(
        { error: "Invalid room ID format" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    console.log(`User ${userId} attempting to leave room ${decodedRoomId}`);

    // 3. Verify room membership
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("id, status")
      .eq("room_id", decodedRoomId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      console.error('Membership check failed:', membershipError?.message || 'No membership found');
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 403 }
      );
    }

    // 4. Check if user has other rooms
    const { data: otherRooms, error: roomsError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId)
      .neq("room_id", decodedRoomId);

    if (roomsError) {
      console.error('Error checking other rooms:', roomsError.message);
      // Continue anyway - this isn't critical
    }

    const hasOtherRooms = otherRooms && otherRooms.length > 0;

    // 5. Get room info for notification
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("name, created_by")
      .eq("id", decodedRoomId)
      .single();

    if (roomError || !room) {
      console.error('Room fetch error:', roomError?.message || 'Room not found');
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // 6. Handle room creator case (prevent leaving if last member)
    if (room.created_by === userId) {
      const { count, error: membersError } = await supabase
        .from("room_members")
        .select("*", { count: "exact" })
        .eq("room_id", decodedRoomId);

      if (membersError) {
        console.error('Error counting members:', membersError.message);
        return NextResponse.json(
          { error: "Failed to verify room members" },
          { status: 500 }
        );
      }

      if (count && count > 1) {
        return NextResponse.json(
          { error: "You cannot leave this room as the creator while other members exist. Please transfer ownership first." },
          { status: 400 }
        );
      }
    }

    // 7. Execute leave operation
    const { error: leaveError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", decodedRoomId)
      .eq("user_id", userId);

    if (leaveError) {
      console.error('Error leaving room:', leaveError.message);
      return NextResponse.json(
        { error: "Failed to leave room", details: leaveError.message },
        { status: 500 }
      );
    }

    // 8. Create notification
    const notification = {
      user_id: userId,
      type: "room_left",
      room_id: decodedRoomId,
      sender_id: userId,
      message: `You have left the room "${room.name}"`,
      status: "unread",
      created_at: new Date().toISOString(),
    };

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(notification);

    if (notificationError) {
      console.error('Notification error:', notificationError.message);
      // Not critical - continue
    }

    // 9. Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully left room "${room.name}"`,
      hasOtherRooms,
      newRoomId: hasOtherRooms ? otherRooms[0]?.room_id : null
    });

  } catch (error) {
    console.error('Unexpected error in leave room endpoint:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}