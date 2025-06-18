import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const notificationId = params.notificationId;

    if (!notificationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select(`
        id, message, created_at, status, type, sender_id, user_id, room_id, join_status, direct_chat_id,
        users:users!notifications_sender_id_fkey(id, username, display_name, avatar_url, created_at),
        recipient:users!notifications_user_id_fkey(id, username, display_name, avatar_url, created_at),
        rooms:rooms(id, name, created_at, created_by, is_private)
      `)
      .eq("id", notificationId)
      .in("type", ["join_request", "room_switch"])
      .eq("user_id", session.user.id)
      .eq("status", "unread")
      .single();

    if (notificationError || !notification) {
      return NextResponse.json({ error: "Notification not found or already processed" }, { status: 404 });
    }

    if (!notification.sender_id || !notification.room_id) {
      return NextResponse.json({ error: "Invalid notification data (missing sender or room ID)" }, { status: 400 });
    }

    const { data: room } = await supabase
      .from("rooms")
      .select("created_by")
      .eq("id", notification.room_id)
      .single();
    if (!room || room.created_by !== session.user.id) {
      return NextResponse.json({ error: "Only the room creator can reject requests" }, { status: 403 });
    }

    await supabase.rpc("reject_notification", {
      p_notification_id: notificationId,
      p_sender_id: notification.sender_id,
      p_room_id: notification.room_id,
      p_timestamp: new Date().toISOString()
    });

    const updatedNotification = transformNotification(notification as any);
    return NextResponse.json({ message: "Request rejected", notification: updatedNotification }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
 
export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function POST() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function PUT() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}