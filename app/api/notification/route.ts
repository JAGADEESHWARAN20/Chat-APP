import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Inotification } from "@/lib/store/notifications";

// Define the raw notification type returned by Supabase
interface RawNotification {
  id: string;
  message: string;
  created_at: string;
  status: string;
  type: string;
  sender_id: string;
  user_id: string;
  room_id: string | null;
  users: { id: any; username: any; display_name: any; avatar_url: any; }[] | null;
  recipient: { id: any; username: any; display_name: any; avatar_url: any; }[] | null;
  rooms: { id: any; name: any; }[] | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch notifications with joins for users (sender), recipient (user_id), and rooms
    const { data: notifications, error } = await supabase
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
        users!notifications_sender_id_fkey (id, username, display_name, avatar_url),
        recipient:users!notifications_user_id_fkey (id, username, display_name, avatar_url),
        rooms!notifications_room_id_fkey (id, name)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message || "Failed to fetch notifications");
    }

    // Transform the raw data to match the Inotification interface
 // Assuming the raw data structure is defined as RawNotification
const transformedNotifications: Inotification[] = notifications.map((notif: RawNotification) => ({
  id: notif.id,
  content: notif.message,
  created_at: notif.created_at,
  is_read: notif.status === "read", // Convert status to boolean
  type: notif.type,
  sender_id: notif.sender_id,
  user_id: notif.user_id, // Ensure this exists in the raw data
  room_id: notif.room_id,
 users: notif.users && notif.users.length > 0
  ? {
      id: notif.users[0].id,
      username: notif.users[0].username,
      display_name: notif.users[0].display_name,
      avatar_url: notif.users[0].avatar_url,
    }
  : null,
  recipient: notif.recipient // Ensure this exists in the raw data
    ? {
        id: notif.recipient.id,
        username: notif.recipient.username,
        display_name: notif.recipient.display_name,
        avatar_url: notif.recipient.avatar_url,
      }
    : null,
  rooms: notif.rooms
    ? {
        id: notif.rooms.id,
        name: notif.rooms.name,
      }
    : null,
}));

    return NextResponse.json(transformedNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
