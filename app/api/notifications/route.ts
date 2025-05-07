import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Inotification } from "@/lib/store/notifications";
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

          // Fetch notifications with joins
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
        users:users!notifications_sender_id_fkey(id, username, display_name, avatar_url),
        recipient:users!notifications_user_id_fkey(id, username, display_name, avatar_url),
        rooms:rooms!notifications_room_id_fkey(id, name)
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

          // Transform to match Inotification interface
          const transformedNotifications: Inotification[] = notifications.map((notif) => ({
               id: notif.id,
               content: notif.message,
               created_at: notif.created_at,
               is_read: notif.status === "read",
               type: notif.type,
               sender_id: notif.sender_id || "",
               user_id: notif.user_id, // This was missing
               room_id: notif.room_id,
               users: notif.users ? {
                    id: notif.users.id,
                    username: notif.users.username,
                    display_name: notif.users.display_name,
                    avatar_url: notif.users.avatar_url
               } : null,
               recipient: notif.recipient ? { // This was missing
                    id: notif.recipient.id,
                    username: notif.recipient.username,
                    display_name: notif.recipient.display_name,
                    avatar_url: notif.recipient.avatar_url
               } : null,
               rooms: notif.rooms ? {
                    id: notif.rooms.id,
                    name: notif.rooms.name
               } : null
          }));

          return NextResponse.json({ success: true, notifications: transformedNotifications });
     } catch (error) {
          console.error("Error fetching notifications:", error);
          return NextResponse.json(
               { error: error instanceof Error ? error.message : "Failed to fetch notifications" },
               { status: 500 }
          );
     }
}