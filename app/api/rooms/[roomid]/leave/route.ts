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

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("Session error:", sessionError?.message || "No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { data: remainingRooms, error: remainingRoomsError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", session.user.id)
      .neq("room_id", roomId);
    const hasOtherRooms = remainingRooms && remainingRooms.length > 0;

    const transaction = async () => {
      const { error: deleteError } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", session.user.id);
      if (deleteError) throw deleteError;

      const { error: participantError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", session.user.id);
      if (participantError) throw participantError;

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
          console.error("Error sending notification:", notificationError.message);
        }
      }
    };

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