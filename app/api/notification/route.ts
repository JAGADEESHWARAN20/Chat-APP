import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Inotification } from "@/lib/store/notifications";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export async function GET(request: Request) {
  try {
    // Extract userId from query parameters or authentication
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

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
    const transformedNotifications: Inotification[] = notifications.map((notif: RawNotification) => ({
      id: notif.id,
      content: notif.message,
      created_at: notif.created_at,
      is_read: notif.status === "read",
      type: notif.type,
      sender_id: notif.sender_id,
      user_id: notif.user_id,
      room_id: notif.room_id,
      users: notif.users && notif.users.length > 0
        ? {
            id: String(notif.users[0].id),
            username: String(notif.users[0].username),
            display_name: String(notif.users[0].display_name),
            avatar_url: notif.users[0].avatar_url != null ? String(notif.users[0].avatar_url) : null,
          }
        : null,
      recipient: notif.recipient && notif.recipient.length > 0
        ? {
            id: String(notif.recipient[0].id),
            username: String(notif.recipient[0].username),
            display_name: String(notif.recipient[0].display_name),
            avatar_url: notif.recipient[0].avatar_url != null ? String(notif.recipient[0].avatar_url) : null,
          }
        : null,
      rooms: notif.rooms && notif.rooms.length > 0
        ? {
            id: String(notif.rooms[0].id),
            name: String(notif.rooms[0].name),
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
