import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Inotification } from "@/lib/store/notifications";
import { RawNotification } from "@/lib/types/notification";
import { transformNotification } from "@/lib/utils/notifications";
import { Database } from "@/lib/types/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch notifications with joins for users (sender), recipient (user_id), and rooms
    const { data: notifications, error: notificationError } = await supabase
      .from("notifications")
      .select(`
        id,
        message,
        created_at,
        status,
        type,
        sender_id,
        user_id,
        room_id,
        users:users!notifications_sender_id_fkey(id, username, display_name, avatar_url, created_at),
        recipient:users!notifications_user_id_fkey(id, username, display_name, avatar_url, created_at),
        rooms:rooms!notifications_room_id_fkey(id, name, created_at, created_by, is_private)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (notificationError) {
      console.error("Error fetching notifications:", notificationError);
      throw new Error(notificationError.message || "Failed to fetch notifications");
    }

    if (!notifications) {
      return NextResponse.json({ notifications: [] });
    }

    // Transform raw notifications to Inotification format using transformNotification
    const transformedNotifications: Inotification[] = notifications.map((notif: RawNotification) =>
      transformNotification({
        ...notif,
        users: notif.users ,
        recipient: notif.recipient ,
        rooms: notif.rooms || null,
      })
    );

    return NextResponse.json({ success: true, notifications: transformedNotifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}