import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

export async function POST(
     req: NextRequest,
     { params }: { params: { id: string } }
) {
     try {
          const supabase = createRouteHandlerClient<Database>({ cookies });
          const notificationId = params.id;

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Fetch notification with related data
          const { data: notification, error: notificationError } = await supabase
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
               .eq("id", notificationId)
               .eq("user_id", session.user.id)
               .single();

          if (notificationError || !notification) {
               return NextResponse.json({ error: "Notification not found" }, { status: 404 });
          }

          // Verify room_id and sender_id are not null
          if (!notification.room_id || !notification.sender_id) {
               return NextResponse.json({ error: "Invalid notification data" }, { status: 400 });
          }

          // Verify user is the room creator
          if (notification.rooms?.created_by !== session.user.id) {
               return NextResponse.json({ error: "Only the room creator can accept join requests" }, { status: 403 });
          }

          // Update room_participants to accepted
          const { error: participantError } = await supabase
               .from("room_participants")
               .update({ status: "accepted", joined_at: new Date().toISOString() })
               .eq("room_id", notification.room_id)
               .eq("user_id", notification.sender_id);
          if (participantError) {
               console.error("Error updating room_participants:", participantError);
               return NextResponse.json({ error: "Failed to accept join request" }, { status: 500 });
          }

          // Add to room_members with upsert to avoid duplicates
          const { error: membershipError } = await supabase
               .from("room_members")
               .upsert(
                    [
                         {
                              room_id: notification.room_id,
                              user_id: notification.sender_id,
                              active: true,
                         },
                    ],
                    { onConflict: "room_id,user_id" }
               );
          if (membershipError) {
               console.error("Error adding to room_members:", membershipError);
               return NextResponse.json({ error: "Failed to add to room_members" }, { status: 500 });
          }

          // Mark notification as read
          const { error: updateError } = await supabase
               .from("notifications")
               .update({ status: "read" })
               .eq("id", notificationId);
          if (updateError) {
               console.error("Error updating notification:", updateError);
          }

          // Notify the requester that they were accepted
          const { data: room, error: roomError } = await supabase
               .from("rooms")
               .select("name")
               .eq("id", notification.room_id)
               .single();
          if (roomError || !room) {
               console.error("Error fetching room:", roomError);
               return NextResponse.json({ error: "Room not found" }, { status: 404 });
          }

          const { data: sender, error: senderError } = await supabase
               .from("users")
               .select("username")
               .eq("id", notification.sender_id)
               .single();
          if (senderError || !sender) {
               console.error("Error fetching sender:", senderError);
               return NextResponse.json({ error: "Sender not found" }, { status: 404 });
          }

          const message = `Your request to join ${room.name} was accepted`;
          const { error: acceptNotificationError } = await supabase
               .from("notifications")
               .insert({
                    user_id: notification.sender_id,
                    type: "user_joined",
                    room_id: notification.room_id,
                    sender_id: session.user.id,
                    message,
                    status: "unread",
                    created_at: new Date().toISOString(),
               });
          if (acceptNotificationError) {
               console.error("Error sending accept notification:", acceptNotificationError);
          }

          // Transform the updated notification
          const transformedNotification = transformNotification({
               ...notification,
               users: notification.users || null,
               recipient: notification.recipient || null,
               rooms: notification.rooms || null,
          });

          return NextResponse.json({ success: true, message: "Join request accepted", notification: transformedNotification });
     } catch (error) {
          console.error("Server error in accept route:", error);
          return NextResponse.json(
               { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
               { status: 500 }
          );
     }
}