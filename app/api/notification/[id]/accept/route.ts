import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const notificationId = params.id;

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch notification
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*, rooms(created_by)")
      .eq("id", notificationId)
      .eq("user_id", session.user.id)
      .single();
    if (notificationError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // Verify user is the room creator
    if (notification.rooms.created_by !== session.user.id) {
      return NextResponse.json({ error: "Only the room creator can accept join requests" }, { status: 403 });
    }

    // Update room_participants to accepted
    const { error: participantError } = await supabase
      .from("room_participants")
      .update({ status: "accepted", joined_at: new Date().toISOString() })
      .eq("room_id", notification.room_id)
      .eq("user_id", notification.sender_id);
    if (participantError) {
      console.error("Error updating participant:", participantError);
      return NextResponse.json({ error: "Failed to accept join request" }, { status: 500 });
    }

    // Add to room_members
    const { error: membershipError } = await supabase
      .from("room_members")
      .insert([
        {
          room_id: notification.room_id,
          user_id: notification.sender_id,
          active: false,
        },
      ]);
    if (membershipError) {
      console.error("Error adding to room_members:", membershipError);
    }

    // Mark notification as read
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", notificationId);
    if (updateError) {
      console.error("Error updating notification:", updateError);
    }

    // Notify the requester that they were accepted
    const { data: room } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", notification.room_id)
      .single();
    const { data: sender } = await supabase
      .from("users")
      .select("username")
      .eq("id", notification.sender_id)
      .single();
    const message = `Your request to join ${room?.name} was accepted`;
    const { error: acceptNotificationError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: notification.sender_id,
          type: "user_joined",
          room_id: notification.room_id,
          sender_id: session.user.id,
          message,
          status: "unread",
        },
      ]);
    if (acceptNotificationError) {
      console.error("Error sending accept notification:", acceptNotificationError);
    }

    return NextResponse.json({ success: true, message: "Join request accepted" });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
