import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const roomId = params.roomId;

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("Session error:", sessionError?.message || "No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the user is a member of the room
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .single();
    if (membershipError || !membership) {
      console.error("Membership error:", membershipError?.message || "No membership found");
      return NextResponse.json({ error: "You are not a member of this room" }, { status: 404 });
    }

    // Check remaining rooms
    const { data: remainingRooms, error: remainingRoomsError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", session.user.id)
      .neq("room_id", roomId);
    if (remainingRoomsError) {
      console.error("Error fetching remaining rooms:", remainingRoomsError.message);
    }
    const hasOtherRooms = remainingRooms && remainingRooms.length > 0;

    // Begin transaction for removal
    const transaction = async () => {
      // Remove from room_members
      const { error: deleteError } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", session.user.id);
      if (deleteError) {
        console.error("Error deleting from room_members:", deleteError.message);
        throw new Error("Failed to remove from room_members");
      }

      // Remove from room_participants
      const { error: participantError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", session.user.id);
      if (participantError) {
        console.error("Error deleting from room_participants:", participantError.message);
        throw new Error("Failed to remove from room_participants");
      }

      // If this was the active room and there are other rooms, activate another
      if (membership.active && hasOtherRooms) {
        const otherRoom = remainingRooms[0];
        const { error: updateError } = await supabase
          .from("room_members")
          .update({ active: true })
          .eq("room_id", otherRoom.room_id)
          .eq("user_id", session.user.id);
        if (updateError) {
          console.error("Error updating active room:", updateError.message);
          throw new Error("Failed to activate another room");
        }
      }

      // Send notification to room creator
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("name, created_by")
        .eq("id", roomId)
        .single();
      if (roomError || !room) {
        console.error("Error fetching room:", roomError?.message || "Room not found");
      } else {
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("username")
          .eq("id", session.user.id)
          .single();
        if (userError) {
          console.error("Error fetching user:", userError.message);
        }
        const message = `${user?.username || "A user"} left ${room.name}`;
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert([
            {
              user_id: room.created_by,
              type: "user_left",
              room_id: roomId,
              sender_id: session.user.id,
              message,
              status: "unread",
            },
          ]);
        if (notificationError) {
          console.error("Error sending notification:", notificationError.message);
        }
      }
    };

    // Execute transaction
    await transaction();

    return NextResponse.json({
      success: true,
      message: "Successfully left the room",
      hasOtherRooms,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in leave route:", errorMessage, error);
    return NextResponse.json({ error: "Failed to leave room", details: errorMessage }, { status: 500 });
  }
}