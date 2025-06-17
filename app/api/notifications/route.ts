import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { transformNotification } from "@/lib/utils/notifications";
import { Inotification } from "@/lib/store/notifications";
import { Database } from "@/lib/types/supabase";

export async function GET(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient<Database>({ cookies });

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("[Notifications GET] Session error:", sessionError?.message);
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const userId = session.user.id;
          console.log(`[Notifications GET] Fetching notifications for user: ${userId}`);

          // Fetch notifications with joins, including all required fields
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
        join_status,
        users:users!notifications_sender_id_fkey(id, username, display_name, avatar_url, created_at),
        recipient:users!notifications_user_id_fkey(id, username, display_name, avatar_url, created_at),
        rooms:rooms!notifications_room_id_fkey(id, name, created_at, created_by, is_private)
      `)
               .eq("user_id", userId)
               .order("created_at", { ascending: false })
               .limit(20);

          if (notificationError) {
               console.error("[Notifications GET] Error fetching notifications:", notificationError.message);
               throw new Error(notificationError.message || "Failed to fetch notifications");
          }

          // Transform notifications using transformNotification
          const transformedNotifications: Inotification[] = notifications
               ? notifications.map((notif) => transformNotification({
                    ...notif,
                    direct_chat_id: null
               }))
               : [];

          return NextResponse.json({ notifications: transformedNotifications }, { status: 200 });
     } catch (error) {
          console.error(
               "[Notifications GET] Server error:",
               error instanceof Error ? error.message : "Unknown error"
          );
          return NextResponse.json(
               { error: error instanceof Error ? error.message : "Failed to fetch notifications" },
               { status: 500 }
          );
     }
}

export async function DELETE(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient<Database>({ cookies });

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("[Notifications DELETE] Session error:", sessionError?.message);
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const userId = session.user.id;
          console.log(`[Notifications DELETE] Deleting notifications for user: ${userId}`);

          // Delete all notifications for the user
          const { error } = await supabase
               .from("notifications")
               .delete()
               .eq("user_id", userId);

          if (error) {
               console.error("[Notifications DELETE] Error deleting notifications:", error.message);
               throw new Error(error.message || "Failed to delete notifications");
          }

          return NextResponse.json({ message: "Notifications cleared" }, { status: 200 });
     } catch (error) {
          console.error(
               "[Notifications DELETE] Server error:",
               error instanceof Error ? error.message : "Unknown error"
          );
          return NextResponse.json(
               { error: error instanceof Error ? error.message : "Failed to delete notifications" },
               { status: 500 }
          );
     }
}