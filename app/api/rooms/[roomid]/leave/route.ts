// /api/rooms/[roomId]/leave.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("Session error:", sessionError?.message || "No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const roomId = params.roomId;
    console.log(`Attempting to leave room ${roomId}`);

    if (!roomId || roomId === "undefined" || !UUID_REGEX.test(roomId)) {
      console.error("Invalid roomId:", roomId);
      return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
    }


    const userId = session.user.id;
    console.log(`User ${userId} is authenticated`);

    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();
    if (membershipError || !membership) {
      console.error(
        "Membership check failed:",
        membershipError?.message || "No membership found"
      );
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 403 }
      );
    }
    console.log(`User ${userId} is a member of room ${roomId}`);

    const { data: remainingRooms, error: remainingRoomsError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId)
      .neq("room_id", roomId);
    if (remainingRoomsError) {
      console.error(
        "Error fetching remaining rooms:",
        remainingRoomsError.message
      );
    }
    const hasOtherRooms = remainingRooms && remainingRooms.length > 0;
    console.log(`User has other rooms: ${hasOtherRooms}`);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      console.error(
        "Room fetch error:",
        roomError?.message || "Room not found"
      );
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    console.log(`Room ${roomId} found: ${room.name}`);

    const { error: deleteError } = await supabase.rpc("leave_room", {
      p_room_id: roomId,
      p_user_id: userId,
    });
    if (deleteError) {
      console.error("Error during leave_room transaction:", deleteError.message);
      return NextResponse.json(
        { error: "Failed to leave room", details: deleteError.message },
        { status: 500 }
      );
    }
    console.log(
      `Successfully removed user ${userId} from room ${roomId} membership and participation`
    );

    const notification = {
      user_id: userId,
      type: "room_left",
      room_id: roomId,
      sender_id: userId,
      message: `You have left the room "${room.name}"`,
      status: "unread",
      created_at: new Date().toISOString(),
    };
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(notification);
    if (notificationError) {
      console.error(
        "Error sending room_left notification:",
        notificationError.message
      );
    } else {
      console.log(`Sent room_left notification to user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      message: "Successfully left the room",
      hasOtherRooms,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in leave route:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to leave room", details: errorMessage },
      { status: 500 }
    );
  }
}