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
          console.log(`Fetching notification with ID: ${notificationId}`);

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message);
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          console.log(`Authenticated user ID: ${session.user.id}`);

          // Step 1: Fetch the notification without joins to isolate RLS or existence issues
          const { data: notificationCore, error: notificationCoreError } = await supabase
               .from("notifications")
               .select("id, message, created_at, status, type, sender_id, user_id, room_id")
               .eq("id", notificationId)
               .single();

          if (notificationCoreError || !notificationCore) {
               console.error("Notification core fetch error:", notificationCoreError?.message || "Notification not found");
               return NextResponse.json({ error: "Notification not found" }, { status: 404 });
          }
          console.log(`Notification found: ${JSON.stringify(notificationCore)}`);

          // Step 2: Fetch related data separately
          if (!notificationCore.sender_id) {
               console.error("Sender ID is null");
               return NextResponse.json({ error: "Invalid notification data: missing sender_id" }, { status: 400 });
          }
          const { data: senderData, error: senderError } = await supabase
               .from("users")
               .select("id, username, display_name, avatar_url, created_at")
               .eq("id", notificationCore.sender_id) // TypeScript now knows sender_id is string
               .single();
          if (senderError || !senderData) {
               console.error("Sender fetch error:", senderError?.message);
               return NextResponse.json({ error: "Sender not found" }, { status: 404 });
          }

          const { data: recipientData, error: recipientError } = await supabase
               .from("users")
               .select("id, username, display_name, avatar_url, created_at")
               .eq("id", notificationCore.user_id)
               .single();
          if (recipientError || !recipientData) {
               console.error("Recipient fetch error:", recipientError?.message);
               return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
          }

          if (!notificationCore.room_id) {
               console.error("Room ID is null");
               return NextResponse.json({ error: "Invalid notification data: missing room_id" }, { status: 400 });
          }
          const { data: roomData, error: roomError } = await supabase
               .from("rooms")
               .select("id, name, created_at, created_by, is_private")
               .eq("id", notificationCore.room_id) // TypeScript now knows room_id is string
               .single();
          if (roomError || !roomData) {
               console.error("Room fetch error:", roomError?.message);
               return NextResponse.json({ error: "Room not found" }, { status: 404 });
          }

          // Construct the full notification object
          const notification = {
               ...notificationCore,
               users: senderData,
               recipient: recipientData,
               rooms: roomData,
          };

          // Verify room_id and sender_id are not null (redundant but kept for clarity)
          if (!notification.room_id || !notification.sender_id) {
               console.error("Invalid notification data: missing room_id or sender_id");
               return NextResponse.json({ error: "Invalid notification data" }, { status: 400 });
          }

          // Verify user is the room creator
          if (notification.rooms.created_by !== session.user.id) {
               console.error(`Permission denied: User ${session.user.id} is not the room creator (${notification.rooms.created_by})`);
               return NextResponse.json({ error: "Only the room creator can accept join requests" }, { status: 403 });
          }

          // Verify the notification is intended for the room creator
          if (notification.user_id !== session.user.id) {
               console.error(`Permission denied: User ${session.user.id} is not the intended recipient (${notification.user_id})`);
               return NextResponse.json({ error: "You are not the intended recipient of this notification" }, { status: 403 });
          }

          // Update room_participants to accepted
          const { error: participantError } = await supabase
               .from("room_participants")
               .update({ status: "accepted", joined_at: new Date().toISOString() })
               .eq("room_id", notification.room_id)
               .eq("user_id", notification.sender_id);
          if (participantError) {
               console.error("Error updating room_participants:", participantError.message);
               return NextResponse.json({ error: "Failed to accept join request", details: participantError.message }, { status: 500 });
          }
          console.log(`Updated room_participants: user ${notification.sender_id} accepted into room ${notification.room_id}`);

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
               console.error("Error adding to room_members:", membershipError.message);
               return NextResponse.json({ error: "Failed to add to room_members", details: membershipError.message }, { status: 500 });
          }
          console.log(`Added user ${notification.sender_id} to room_members for room ${notification.room_id}`);

          // Mark notification as read
          const { error: updateError } = await supabase
               .from("notifications")
               .update({ status: "read" })
               .eq("id", notificationId);
          if (updateError) {
               console.error("Error updating notification status:", updateError.message);
          } else {
               console.log(`Marked notification ${notificationId} as read`);
          }

          // Notify the requester that they were accepted
          const message = `Your request to join ${notification.rooms.name} was accepted`;
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
               console.error("Error sending accept notification:", acceptNotificationError.message);
          } else {
               console.log(`Sent user_joined notification to user ${notification.sender_id}`);
          }

          // Transform the updated notification
          const transformedNotification = transformNotification({
               ...notification,
               status: "read", // Reflect the updated status
               users: notification.users,
               recipient: notification.recipient,
               rooms: notification.rooms,
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