// api/notifications/[notificationId]/route.ts (Accept API - POST)
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

type NotificationType = "join_request" | "new_message" | "room_switch" | "notification_unread" | "user_joined" | "join_request_rejected";

export async function POST(req: NextRequest, { params }: { params: { notificationId: string } }) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const timestamp = new Date().toISOString();

  try {
    const notificationId = params.notificationId;

    if (!notificationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Authentication error" }, { status: 401 });
    }
    const currentUserId = session.user.id; // The user making the request (room owner/admin)

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // For a join_request notification:
    // notification.user_id is the recipient (room owner)
    // notification.sender_id is the user requesting to join
    const userToJoinRoom = notification.sender_id; // The user whose request is being accepted
    const roomId = notification.room_id;

    if (notification.type !== "join_request" || !userToJoinRoom || !roomId) {
      return NextResponse.json({ error: "This notification is not a join request or is malformed" }, { status: 400 });
    }

    // Verify current user is the room owner (or an admin, if you have that concept)
    const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("created_by")
        .eq("id", roomId)
        .single();

    if (roomError || !room) {
        return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
    }

    // Authorization check: Only the room creator can accept join requests.
    if (currentUserId !== room.created_by) {
        return NextResponse.json({ error: "Unauthorized: Only the room owner can accept join requests" }, { status: 403 });
    }

    // Ensure the notification is for the current user (room owner)
    if (notification.user_id !== currentUserId) {
         return NextResponse.json({ error: "Unauthorized: Notification not addressed to current user" }, { status: 403 });
    }


    const { error: updateError } = await supabase.rpc("accept_notification", {
      p_notification_id: notificationId,
      p_target_user_id: userToJoinRoom, // This is the user who wants to join the room
      p_room_id: roomId,
      p_timestamp: timestamp
    });

    if (updateError) {
      if (updateError.code === "23505") { // Unique violation, e.g., user already in room_members
        return NextResponse.json({ error: "User is already a member of this room" }, { status: 409 });
      }
      console.error("[Accept API] RPC Error:", updateError.message);
      return NextResponse.json({ error: "Failed to accept request", details: updateError.message }, { status: 500 });
    }

    // After RPC, the notification status should be updated by the RPC or a trigger
    // and the room_members table should be updated.
    // The client-side real-time listener will pick up these changes.

    return NextResponse.json({
      message: "Request accepted successfully",
      data: { notificationId, roomId: roomId, userId: userToJoinRoom, timestamp }
    });
  } catch (error) {
    console.error("[Accept API] Catch Error:", error);
    return NextResponse.json({ error: "Failed to accept request", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { Allow: "POST", "Content-Type": "application/json" } });
}
export async function GET() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
export async function DELETE() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
export async function PUT() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
