import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

type NotificationType = "join_request" | "room_invite" | "message";

type NotificationCore = {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: NotificationType;
  sender_id: string;
  user_id: string;
  room_id: string;
  join_status: string | null;
  direct_chat_id: string | null;
};

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

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const targetUserId = notification.type === "join_request" ? notification.sender_id : notification.user_id;
    if (!targetUserId || !notification.room_id) {
      return NextResponse.json({ error: "Invalid notification data" }, { status: 400 });
    }

    const { error: updateError } = await supabase.rpc("accept_notification", {
      p_notification_id: notificationId,
      p_target_user_id: targetUserId,
      p_room_id: notification.room_id,
      p_timestamp: timestamp
    });

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json({ error: "Already a member of this room" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to accept request" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Request accepted successfully",
      data: { notificationId, roomId: notification.room_id, userId: targetUserId, timestamp }
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to accept request", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } });
}
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } });
}
export async function PUT() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } });
}