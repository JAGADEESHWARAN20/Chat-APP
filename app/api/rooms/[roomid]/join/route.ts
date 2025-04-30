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

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if user is already a member
    const { data: existingMember, error: memberError } = await supabase
      .from("room_participants")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .single();
    if (existingMember) {
      return NextResponse.json(
        { error: "Already a member or request pending", status: existingMember.status },
        { status: 400 }
      );
    }

    // Add user to room_participants
    const { data: participant, error: participantError } = await supabase
      .from("room_participants")
      .insert([
        {
          room_id: roomId,
          user_id: session.user.id,
          status: room.is_private ? "pending" : "accepted",
          joined_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (participantError) {
      console.error("Error joining room:", participantError);
      return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
    }

    // If private room, send notification to creator
    if (room.is_private) {
      const { data: creator, error: creatorError } = await supabase
        .from("users")
        .select("username")
        .eq("id", session.user.id)
        .single();
      if (creatorError) {
        console.error("Error fetching creator:", creatorError);
      }

      const message = `${creator?.username || "A user"} requested to join ${room.name}`;
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: room.created_by,
            type: "join_request",
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

    // If room is not private, add to room_members and switch to the room
    if (!room.is_private) {
      const { error: membershipError } = await supabase
        .from("room_members")
        .insert([
          {
            room_id: roomId,
            user_id: session.user.id,
            active: true,
          },
        ]);
      if (membershipError) {
        console.error("Error adding to room_members:", membershipError);
      }

      // Set other rooms as inactive
      await supabase
        .from("room_members")
        .update({ active: false })
        .eq("user_id", session.user.id)
        .neq("room_id", roomId);
    }

    return NextResponse.json({
      success: true,
      status: participant.status,
      message: room.is_private ? "Join request sent" : "Joined room successfully",
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
