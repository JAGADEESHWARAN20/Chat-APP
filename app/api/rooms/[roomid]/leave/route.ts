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
      return NextResponse.json({ error: "You are not a member of this room" }, { status: 404 });
    }

    // Begin transaction for removal
    const transaction = async () => {
      // Remove from room_members
      const { error: deleteError } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", session.user.id);
      if (deleteError) throw deleteError;

      // Remove from room_participants
      const { error: participantError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", session.user.id);
      if (participantError) throw participantError;

      // If this was the active room, find another room to make active
      if (membership.active) {
        const { data: otherRoom } = await supabase
          .from("room_members")
          .select("room_id")
          .eq("user_id", session.user.id)
          .neq("room_id", roomId)
          .limit(1)
          .single();
        if (otherRoom) {
          const { error: updateError } = await supabase
            .from("room_members")
            .update({ active: true })
            .eq("room_id", otherRoom.room_id)
            .eq("user_id", session.user.id);
          if (updateError) throw updateError;
        }
      }

      // Send notification to room creator
      const { data: room } = await supabase
        .from("rooms")
        .select("name, created_by")
        .eq("id", roomId)
        .single();
      if (room) {
        const { data: user } = await supabase
          .from("users")
          .select("username")
          .eq("id", session.user.id)
          .single();
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
          console.error("Error sending notification:", notificationError);
        }
      }
    };

    // Execute transaction
    await transaction();

    return NextResponse.json({
      success: true,
      message: "Successfully left the room",
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Failed to leave room" }, { status: 500 });
  }
}
