import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Inotification } from "@/lib/store/notifications";
import { RawNotification } from "@/lib/types/notification";

export async function GET(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Fetch notifications for the user
          const { data: notifications, error: fetchError } = await supabase
               .from("notifications")
               .select(`
        id,
        message,
        created_at,
        status,
        type,
        sender_id,
        room_id,
        user_id,
        users!sender_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        rooms!room_id (
          id,
          name
        )
      `)
               .eq("user_id", session.user.id)
               .order("created_at", { ascending: false })
               .returns<RawNotification[]>(); // Explicitly type the result

          if (fetchError) {
               console.error("Error fetching notifications:", fetchError);
               return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
          }

          // Transform the raw data to match the Inotification interface
          const transformedNotifications: Inotification[] = notifications.map((notif: RawNotification) => ({
               id: notif.id,
               content: notif.message,
               created_at: notif.created_at,
               is_read: notif.status === "read",
               type: notif.type,
               sender_id: notif.sender_id,
               user_id: notif.user_id, // Added user_id as required by Inotification
               room_id: notif.room_id,
               users: notif.users, // Now a single object or null
               recipient: notif.users ? { // Map users to recipient as per Inotification expectation
                    id: notif.users.id,
                    username: notif.users.username,
                    display_name: notif.users.display_name,
                    avatar_url: notif.users.avatar_url || null,
               } : null,
               rooms: notif.rooms, // Now a single object or null
          }));

          return NextResponse.json({ success: true, notifications: transformedNotifications });
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Server error in notifications route:", errorMessage, error);
          return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
     }
}
