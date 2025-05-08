import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const roomId = params.roomId;
    console.log(`Attempting to leave room ${roomId}`);

    // Validate roomId
    if (!roomId || roomId === "undefined" || !UUID_REGEX.test(roomId)) {
      console.error("Invalid roomId:", roomId);
      return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
    }

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("Session error:", sessionError?.message || "No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`User ${userId} is authenticated`);

    // Check if the user is a member of the room
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("active", true)
      .single();
    if (membershipError || !membership) {
      console.error("Membership check failed:", membershipError?.message || "No active membership found");
      return NextResponse.json({ error: "You are not an active member of this room" }, { status: 404 });
    }
    console.log(`User ${userId} is an active member of room ${roomId}`);

    // Check remaining rooms for the user
    const { data: remainingRooms, error: remainingRoomsError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId)
      .eq("active", true)
      .neq("room_id", roomId);
    if (remainingRoomsError) {
      console.error("Error fetching remaining rooms:", remainingRoomsError.message);
    }
    const hasOtherRooms = remainingRooms && remainingRooms.length > 0;
    console.log(`User has other rooms: ${hasOtherRooms}`);

    // Fetch room details for the notification
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      console.error("Room fetch error:", roomError?.message || "Room not found");
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    console.log(`Room ${roomId} found: ${room.name}`);

    // Delete the user's record from room_members
    const { error: deleteMemberError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (deleteMemberError) {
      console.error("Error deleting from room_members:", deleteMemberError.message);
      return NextResponse.json(
        { error: "Failed to remove from room members", details: deleteMemberError.message },
        { status: 500 }
      );
    }
    console.log(`Deleted user ${userId} from room_members for room ${roomId}`);

    // Delete the user's record from room_participants
    const { error: deleteParticipantError } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (deleteParticipantError) {
      console.error("Error deleting from room_participants:", deleteParticipantError.message);
      return NextResponse.json(
        { error: "Failed to remove from room participants", details: deleteParticipantError.message },
        { status: 500 }
      );
    }
    console.log(`Deleted user ${userId} from room_participants for room ${roomId}`);

    // Send a notification to the authenticated user (the user who left)
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
      console.error("Error sending room_left notification:", notificationError.message);
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