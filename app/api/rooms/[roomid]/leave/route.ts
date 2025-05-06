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

    const userId = session.user.id;

    // Check if the user is a member of the room
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("active", true) // Only consider active memberships
      .single();
    if (membershipError || !membership) {
      console.error("Membership error:", membershipError?.message || "No active membership found");
      return NextResponse.json({ error: "You are not an active member of this room" }, { status: 404 });
    }

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

    // Fetch room and user details for the notification
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      console.error("Room fetch error:", roomError?.message || "Room not found");
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single();
    if (userError) {
      console.error("User fetch error:", userError.message);
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    // Update room_members: set active to false
    const { error: updateMemberError } = await supabase
      .from("room_members")
      .update({ active: false })
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (updateMemberError) {
      console.error("Error updating room_members:", updateMemberError.message);
      return NextResponse.json({ error: "Failed to update room membership" }, { status: 500 });
    }

    // Update room_participants: set status to "rejected"
    const { error: updateParticipantError } = await supabase
      .from("room_participants")
      .update({ status: "rejected", joined_at: null })
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (updateParticipantError) {
      console.error("Error updating room_participants:", updateParticipantError.message);
      return NextResponse.json({ error: "Failed to update participant status" }, { status: 500 });
    }

    // Broadcast user_left notification to all remaining active room members
    const { data: roomMembers, error: membersError } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("active", true);
    if (membersError) {
      console.error("Error fetching room members for notification:", membersError.message);
    } else {
      const memberIds = roomMembers.map((member: { user_id: string }) => member.user_id);
      for (const memberId of memberIds) {
        if (memberId !== userId) { // Skip the user who left
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert([
              {
                user_id: memberId,
                type: "user_left",
                room_id: roomId,
                sender_id: userId,
                message: `${user?.username || "A user"} left ${room.name}`,
                status: "unread",
                created_at: new Date().toISOString(),
              },
            ]);
          if (notificationError) {
            console.error("Error sending user_left notification:", notificationError.message);
          }
        }
      }
    }

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