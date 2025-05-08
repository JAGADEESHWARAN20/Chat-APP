import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

// PATCH: Accept a join request notification
export async function PATCH(
     req: NextRequest,
     { params }: { params: { notificationId: string } }
) {
     try {
          const supabase = createRouteHandlerClient<Database>({ cookies });
          const notificationId = params.notificationId;
          console.log(`Processing accept for notification ID: ${notificationId}`);

          // Validate notificationId
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!notificationId || !uuidRegex.test(notificationId)) {
               console.error(`Invalid notification ID: ${notificationId}`);
               return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
          }

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message);
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          console.log(`Authenticated user ID: ${session.user.id}`);

          // Fetch the notification to verify it exists, is a join_request, and is pending
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

          // Fetch related data
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
               return NextResponse.json({ error: "Only the room creator can accept join requests" }, { status: 403 });
          }

          // Update room_participants to accepted
          const { error: participantError } = await supabase
               .from("room_participants")
               .update({ status: "accepted", joined_at: new Date().toISOString() })
               .eq("room_id", notificationCore.room_id)
               .eq("user_id", notificationCore.sender_id);
          if (participantError) {
               console.error("Error updating room_participants:", participantError.message);
               return NextResponse.json({ error: "Failed to accept join request", details: participantError.message }, { status: 500 });
          }
          console.log(`Updated room_participants: user ${notificationCore.sender_id} accepted into room ${notificationCore.room_id}`);

          // Add to room_members with upsert to avoid duplicates
          const { error: membershipError } = await supabase
               .from("room_members")
               .upsert(
                    [
                         {
                              room_id: notificationCore.room_id,
                              user_id: notificationCore.sender_id,
                              active: true,
                         },
                    ],
                    { onConflict: "room_id,user_id" }
               );
          if (membershipError) {
               console.error("Error adding to room_members:", membershipError.message);
               return NextResponse.json({ error: "Failed to add to room_members", details: membershipError.message }, { status: 500 });
          }
          console.log(`Added user ${notificationCore.sender_id} to room_members for room ${notificationCore.room_id}`);

          // Update the notification's join_status to 'accepted' and status to 'read'
          const { error: updateError } = await supabase
               .from("notifications")
               .update({ join_status: "accepted", status: "read" })
               .eq("id", notificationId);
          if (updateError) {
               console.error("Error updating notification status:", updateError.message);
          } else {
               console.log(`Updated notification ${notificationId}: join_status to accepted, status to read`);
          }

          // Notify the requester that they were accepted
          const message = `Your request to join ${roomData.name} was accepted`;
          const { error: acceptNotificationError } = await supabase
               .from("notifications")
               .insert({
                    user_id: notificationCore.sender_id,
                    type: "user_joined",
                    room_id: notificationCore.room_id,
                    sender_id: session.user.id,
                    message,
                    status: "unread",
                    created_at: new Date().toISOString(),
                    join_status: null, // Explicitly set for clarity
               });
          if (acceptNotificationError) {
               console.error("Error sending accept notification:", acceptNotificationError.message);
          } else {
               console.log(`Sent user_joined notification to user ${notificationCore.sender_id}`);
          }

          // Construct the updated notification object for the response
          const notification = {
               ...notificationCore,
               join_status: "accepted",
               status: "read",
               users: senderData,
               recipient: recipientData,
               rooms: roomData,
          };

          // Transform the updated notification
          const transformedNotification = transformNotification(notification);

          return NextResponse.json({ message: "Join request accepted", notification: transformedNotification }, { status: 200 });
     } catch (error) {
          console.error("Server error in accept route:", error);
          return NextResponse.json(
               { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
               { status: 500 }
          );
     }
}

// Fallback handlers for unsupported methods
export async function OPTIONS() {
     return new NextResponse(null, {
          status: 405,
          headers: {
               Allow: "PATCH",
          },
     });
}

export async function GET() {
     return new NextResponse(null, {
          status: 405,
          headers: {
               Allow: "PATCH",
          },
     });
}

export async function POST() {
     return new NextResponse(null, {
          status: 405,
          headers: {
               Allow: "PATCH",
          },
     });
}

export async function DELETE() {
     return new NextResponse(null, {
          status: 405,
          headers: {
               Allow: "PATCH",
          },
     });
}

export async function PUT() {
     return new NextResponse(null, {
          status: 405,
          headers: {
               Allow: "PATCH",
          },
     });
}