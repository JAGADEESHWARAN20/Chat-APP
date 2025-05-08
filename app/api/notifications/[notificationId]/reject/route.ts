import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

export async function PATCH(
     req: NextRequest,
     { params }: { params: { notificationId: string } }
) {
     try {
          const supabase = createRouteHandlerClient<Database>({ cookies });
          const notificationId = params.notificationId;
          console.log(`Processing reject for notification ID: ${notificationId}`);

          // Validate notificationId
          if (!notificationId || notificationId === "undefined") {
               console.error("Invalid notification ID: notificationId is undefined or invalid");
               return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
          }

          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(notificationId)) {
               console.error(`Invalid notification ID format: ${notificationId}`);
               return NextResponse.json({ error: "Invalid notification ID format" }, { status: 400 });
          }

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message);
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          console.log(`Authenticated user ID: ${session.user.id}`);

          // Fetch the notification to verify it exists and is a join_request
          const { data: notificationCore, error: notificationCoreError } = await supabase
               .from("notifications")
               .select("id, message, created_at, status, type, sender_id, user_id, room_id, join_status")
               .eq("id", notificationId)
               .eq("type", "join_request")
               .eq("user_id", session.user.id)
               .single();

          if (notificationCoreError || !notificationCore) {
               console.error("Notification fetch error:", notificationCoreError?.message || "Notification not found");
               return NextResponse.json({ error: "Notification not found or not a join request" }, { status: 404 });
          }

          // Check if the join_status is still pending
          if (notificationCore.join_status !== "pending") {
               console.error(`Join request already processed: current status is ${notificationCore.join_status}`);
               return NextResponse.json({ error: `Join request already ${notificationCore.join_status}` }, { status: 400 });
          }

          // Fetch related data for the response
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

          // Verify user is the room creator
          if (roomData.created_by !== session.user.id) {
               console.error(`Permission denied: User ${session.user.id} is not the room creator (${roomData.created_by})`);
               return NextResponse.json({ error: "Only the room creator can reject join requests" }, { status: 403 });
          }

          // Update the notification's join_status to 'rejected' and status to 'read'
          const { error: updateError } = await supabase
               .from("notifications")
               .update({ join_status: "rejected", status: "read" })
               .eq("id", notificationId);
          if (updateError) {
               console.error("Error updating notification status:", updateError.message);
               return NextResponse.json({ error: "Failed to update notification", details: updateError.message }, { status: 500 });
          }
          console.log(`Updated notification ${notificationId}: join_status to rejected, status to read`);

          // Notify the requester that they were rejected
          const message = `Your request to join ${roomData.name} was rejected`;
          const { error: rejectNotificationError } = await supabase
               .from("notifications")
               .insert([
                    {
                         user_id: notificationCore.sender_id,
                         type: "join_request_rejected",
                         room_id: notificationCore.room_id,
                         sender_id: session.user.id,
                         message,
                         status: "unread",
                         created_at: new Date().toISOString(),
                         join_status: null, // Explicitly set join_status to null for non-join_request notifications
                    },
               ]);
          if (rejectNotificationError) {
               console.error("Error sending reject notification:", rejectNotificationError.message);
               return NextResponse.json({ error: "Failed to send reject notification", details: rejectNotificationError.message }, { status: 500 });
          }
          console.log(`Sent join_request_rejected notification to user ${notificationCore.sender_id}`);

          // Construct the updated notification object for the response
          const notification = {
               ...notificationCore,
               join_status: "rejected",
               status: "read",
               users: senderData,
               recipient: recipientData,
               rooms: roomData,
          };

          // Transform the updated notification
          const transformedNotification = transformNotification(notification);

          return NextResponse.json({ success: true, message: "Join request rejected", notification: transformedNotification });
     } catch (error) {
          console.error("Server error in reject route:", error);
          return NextResponse.json(
               { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
               { status: 500 }
          );
     }
}