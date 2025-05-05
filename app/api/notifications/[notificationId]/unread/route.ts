import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { notificationId: string } }) {
     const supabase = supabaseServer();
     const { notificationId } = params;

     // Get the authenticated user
     const { data: { user }, error: authError } = await supabase.auth.getUser();
     if (authError || !user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     // Fetch the notification to get the room_id and message
     const { data: notification, error: fetchError } = await supabase
          .from("notifications")
          .select("room_id, message") // Changed from "content" to "message"
          .eq("id", notificationId)
          .eq("user_id", user.id)
          .single();

     if (fetchError || !notification) {
          return NextResponse.json({ error: "Notification not found" }, { status: 404 });
     }

     // Update the notification status to "unread"
     const { error: updateError } = await supabase
          .from("notifications")
          .update({ status: "unread" })
          .eq("id", notificationId)
          .eq("user_id", user.id);

     if (updateError) {
          return NextResponse.json({ error: updateError.message || "Failed to mark as unread" }, { status: 500 });
     }

     // If there's a room_id, notify all room members
     if (notification.room_id) {
          // Fetch room participants
          const { data: participants, error: participantsError } = await supabase
               .from("room_participants")
               .select("user_id")
               .eq("room_id", notification.room_id)
               .eq("status", "accepted");

          if (participantsError) {
               return NextResponse.json({ error: participantsError.message || "Failed to fetch room participants" }, { status: 500 });
          }

          // Create new notifications for each participant (except the current user)
          const newNotifications = participants
               .filter((participant) => participant.user_id !== user.id)
               .map((participant) => ({
                    id: crypto.randomUUID(),
                    user_id: participant.user_id,
                    sender_id: user.id,
                    room_id: notification.room_id,
                    message: `${user.email || "A user"} marked a notification as unread: ${notification.message}`, // Changed from "content" to "message"
                    type: "notification_unread",
                    status: "unread",
                    created_at: new Date().toISOString(),
               }));

          if (newNotifications.length > 0) {
               const { error: insertError } = await supabase
                    .from("notifications")
                    .insert(newNotifications);

               if (insertError) {
                    return NextResponse.json({ error: insertError.message || "Failed to notify room members" }, { status: 500 });
               }
          }
     }

     return NextResponse.json({ message: "Notification marked as unread" }, { status: 200 });
}