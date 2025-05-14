// app/api/rooms/[roomId]/leave/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("Session error:", sessionError?.message || "No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get room ID from params (handle both camelCase and lowercase)
    const roomId = params.roomId;
    console.log(roomId)
    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    console.log('Received roomId:', roomId);

    // Decode and validate room ID
    const decodedRoomId = decodeURIComponent(roomId);
    console.log('Decoded roomId:', decodedRoomId);

    if (!UUID_REGEX.test(decodedRoomId)) {
      return NextResponse.json(
        { error: "Invalid room ID format. Expected UUID format." },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    console.log(`User ${userId} attempting to leave room ${decodedRoomId}`);

    // Check if the user is a member of the room
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", decodedRoomId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      console.error("Membership check failed:", membershipError?.message || "No membership found");
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 403 }
      );
    }

    // Fetch remaining rooms for the user
    const { data: remainingRooms, error: remainingRoomsError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId)
      .neq("room_id", decodedRoomId);

    const hasOtherRooms = remainingRooms && remainingRooms.length > 0;

    // Fetch room details for notification
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", decodedRoomId)
      .single();

    if (roomError || !room) {
      console.error("Room fetch error:", roomError?.message || "Room not found");
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Call the leave_room RPC
    const { error: deleteError } = await supabase.rpc("leave_room", {
      p_room_id: decodedRoomId,
      p_user_id: userId,
    });

    if (deleteError) {
      console.error("Error during leave_room transaction:", deleteError.message);
      return NextResponse.json(
        { error: "Failed to leave room", details: deleteError.message },
        { status: 500 }
      );
    }

    // Send a notification
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
      console.error("Error sending room_left notification:", notificationError.message);
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
