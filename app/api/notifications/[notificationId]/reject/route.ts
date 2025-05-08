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

          // Step 1: Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message);
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          console.log(`Authenticated user ID: ${session.user.id}`);

          // Step 2: Fetch the notification without joins to isolate RLS or existence issues
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

          // Step 3: Fetch related data separately to handle nullable fields safely
          if (!notificationCore.sender_id) {
               console.error("Sender ID is null");
               return NextResponse.json({ error: "Invalid notification data: missing sender_id" }, { status: 400 });
          }
          const { data: senderData, error: senderError } = await supabase
               .from("users")
               .select("id, username, display_name, avatar_url, created_at")
               .eq("id", notificationCore.sender_id)
               .single();
          if (senderError || !senderData) {
               console.error("Sender fetch error:", senderError?.message);
               return NextResponse.json({ error: "Sender not found" }, { status: 404 });
          }

          if (!notificationCore.user_id) {
               console.error("Recipient ID is null");
               return NextResponse.json({ error: "Invalid notification data: missing user_id" }, { status: 400 });
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
               .eq("id", notificationCore.room_id)
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

          // Step 4: Verify user is the room creator
          if (notification.rooms.created_by !== session.user.id) {
               console.error(`Permission denied: User ${session.user.id} is not the room creator (${notification.rooms.created_by})`);
               return NextResponse.json({ error: "Only the room creator can reject join requests" }, { status: 403 });
          }

          // Step 5: Verify the notification is intended for the room creator
          if (notification.user_id !== session.user.id) {
               console.error(`Permission denied: User ${session.user.id} is not the intended recipient (${notification.user_id})`);
               return NextResponse.json({ error: "You are not the intended recipient of this notification" }, { status: 403 });
          }

          // Step 6: Update room_participants to rejected and clear joined_at
          const { error: participantError } = await supabase
               .from("room_participants")
               .update({ status: "rejected", joined_at: undefined }) // Changed null to undefined
               .eq("room_id", notification.room_id as string) // Type assertion after validation
               .eq("user_id", notification.sender_id as string); // Type assertion after validation
          if (participantError) {
               console.error("Error updating room_participants:", participantError.message);
               return NextResponse.json({ error: "Failed to reject join request", details: participantError.message }, { status: 500 });
          }
          console.log(`Updated room_participants: user ${notification.sender_id} rejected from room ${notification.room_id}`);

          // Step 7: Ensure user is not active in room_members (if they were added previously)
          const { data: membership, error: membershipError } = await supabase
               .from("room_members")
               .select("*")
               .eq("room_id", notification.room_id as string) // Type assertion
               .eq("user_id", notification.sender_id as string) // Type assertion
               .eq("active", true)
               .single();
          if (membershipError && membershipError.code !== "PGRST116") { // PGRST116 means no rows found, which is fine
               console.error("Error checking room_members:", membershipError.message);
          }
          if (membership) {
               const { error: updateMembershipError } = await supabase
                    .from("room_members")
                    .update({ active: false })
                    .eq("room_id", notification.room_id as string) // Type assertion
                    .eq("user_id", notification.sender_id as string); // Type assertion
               if (updateMembershipError) {
                    console.error("Error updating room_members:", updateMembershipError.message);
               } else {
                    console.log(`Updated room_members: set active=false for user ${notification.sender_id} in room ${notification.room_id}`);
               }
          } else {
               console.log(`User ${notification.sender_id} was not in room_members for room ${notification.room_id}`);
          }

          // Step 8: Mark notification as read
          const { error: updateError } = await supabase
               .from("notifications")
               .update({ status: "read" })
               .eq("id", notificationId);
          if (updateError) {
               console.error("Error updating notification status:", updateError.message);
          } else {
               console.log(`Marked notification ${notificationId} as read`);
          }

          // Step 9: Notify the requester that they were rejected
          const message = `Your request to join ${notification.rooms.name} was rejected`;
          const { error: rejectNotificationError } = await supabase
               .from("notifications")
               .insert([ // Pass as an array to match the correct overload
                    {
                         user_id: notification.sender_id as string, // Type assertion
                         type: "join_request_rejected",
                         room_id: notification.room_id as string, // Type assertion
                         sender_id: session.user.id,
                         message,
                         status: "unread",
                         created_at: new Date().toISOString(),
                    },
               ]);
          if (rejectNotificationError) {
               console.error("Error sending reject notification:", rejectNotificationError.message);
          } else {
               console.log(`Sent join_request_rejected notification to user ${notification.sender_id}`);
          }

          // Step 10: Transform the updated notification
          const transformedNotification = transformNotification({
               ...notification,
               status: "read", // Reflect the updated status
               users: notification.users,
               recipient: notification.recipient,
               rooms: notification.rooms,
          });

          return NextResponse.json({ success: true, message: "Join request rejected", notification: transformedNotification });
     } catch (error) {
          console.error("Server error in reject route:", error);
          return NextResponse.json(
               { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
               { status: 500 }
          );
     }
}