import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
     req: NextRequest,
     { params }: { params: { notificationId: string } }
) {
     const supabase = createRouteHandlerClient({ cookies });
     const { notificationId } = params;

     try {
          // Get the authenticated user
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Verify the notification belongs to the user
          const { data: notification, error: fetchError } = await supabase
               .from("notifications")
               .select("id, user_id, room_id, message")
               .eq("id", notificationId)
               .eq("user_id", session.user.id)
               .single();
          if (fetchError || !notification) {
               return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 });
          }

          // Update the notification status to "read"
          const { error: updateError } = await supabase
               .from("notifications")
               .update({ status: "read" })
               .eq("id", notificationId);
          if (updateError) {
               throw updateError;
          }

          // If there's a room_id, notify room members
          if (notification.room_id) {
               const { data: participants, error: participantsError } = await supabase
                    .from("room_participants")
                    .select("user_id")
                    .eq("room_id", notification.room_id)
                    .eq("status", "accepted");

               if (participantsError) {
                    console.error("Error fetching participants:", participantsError);
               } else {
                    const newNotifications = participants
                         .filter((participant) => participant.user_id !== session.user.id)
                         .map((participant) => ({
                              id: crypto.randomUUID(),
                              user_id: participant.user_id,
                              sender_id: session.user.id,
                              room_id: notification.room_id,
                              message: `${session.user.email || "A user"} marked a notification as read: ${notification.message}`,
                              type: "notification_read",
                              status: "unread",
                              created_at: new Date().toISOString(),
                         }));

                    if (newNotifications.length > 0) {
                         const { error: insertError } = await supabase
                              .from("notifications")
                              .insert(newNotifications);
                         if (insertError) {
                              console.error("Error sending notifications to room members:", insertError);
                         }
                    }
               }
          }

          return NextResponse.json({ success: true, message: "Notification marked as read" });
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return NextResponse.json({ error: "Failed to mark notification as read", details: errorMessage }, { status: 500 });
     }
}