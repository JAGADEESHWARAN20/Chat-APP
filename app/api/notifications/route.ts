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
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const userId = session.user.id;

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
               console.error("Error fetching notifications:", notificationError);
               throw new Error(notificationError.message || "Failed to fetch notifications");
          }

          // Transform notifications using transformNotification
          const transformedNotifications: Inotification[] = notifications
               ? notifications.map(transformNotification)
               : [];

          return NextResponse.json({ notifications: transformedNotifications }, { status: 200 });
     } catch (error) {
          console.error("Error fetching notifications:", error);
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
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const userId = session.user.id;

          // Delete all notifications for the user
          const { error } = await supabase
               .from("notifications")
               .delete()
               .eq("user_id", userId);

          if (error) {
               console.error("Error deleting notifications:", error);
               throw new Error(error.message || "Failed to delete notifications");
          }

          return NextResponse.json({ message: "Notifications cleared" }, { status: 200 });
     } catch (error) {
          console.error("Error deleting notifications:", error);
          return NextResponse.json(
               { error: error instanceof Error ? error.message : "Failed to delete notifications" },
               { status: 500 }
          );
     }
}