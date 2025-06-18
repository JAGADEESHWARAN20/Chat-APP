import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

// Define a stricter type for notificationCore after validation
type NotificationCore = {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: "join_request" | "room_switch";
  sender_id: string;
  user_id: string;
  room_id: string;
  join_status: string | null;
  direct_chat_id: string | null;
};

export async function PATCH(req: NextRequest, { params }: { params: { notificationId: string } }) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const timestamp = new Date().toISOString();
  
  try {
    const notificationId = params.notificationId;

    // Validate notificationId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!notificationId || !uuidRegex.test(notificationId)) {
      console.error(`[Notifications Accept] Invalid notification ID: ${notificationId}`);
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[Notifications Accept] Session error:", sessionError?.message);
      return NextResponse.json({ error: "Authentication error", details: sessionError.message }, { status: 401 });
    }
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized: No active session" }, { status: 401 });
    }

    // Fetch notification with detailed error logging
    const { data: notificationCore, error: notificationCoreError } = await supabase
      .from("notifications")
      .select("id, message, created_at, status, type, sender_id, user_id, room_id, join_status, direct_chat_id")
      .eq("id", notificationId)
      .in("type", ["join_request", "room_switch"])
      .eq("user_id", session.user.id)
      .eq("status", "unread")
      .single();

    if (notificationCoreError) {
      console.error("[Notifications Accept] Notification fetch error:", {
        error: notificationCoreError.message,
        details: notificationCoreError,
        params: { notificationId, userId: session.user.id }
      });
      return NextResponse.json({ 
        error: "Failed to fetch notification", 
        details: notificationCoreError.message 
      }, { status: 404 });
    }

    if (!notificationCore) {
      return NextResponse.json({
        error: "Notification not found or already processed",
        details: "The notification may not exist, be already processed, or you may not have permission to access it"
      }, { status: 404 });
    }

    // Validate notification data with detailed type checking
    if (
      !notificationCore.sender_id ||
      !notificationCore.user_id ||
      !notificationCore.room_id ||
      typeof notificationCore.sender_id !== "string" ||
      typeof notificationCore.user_id !== "string" ||
      typeof notificationCore.room_id !== "string" ||
      notificationCore.status === null ||
      !["join_request", "room_switch"].includes(notificationCore.type)
    ) {
      console.error("[Notifications Accept] Invalid notification data:", {
        notification: notificationCore,
        validation: {
          hasSenderId: Boolean(notificationCore.sender_id),
          hasUserId: Boolean(notificationCore.user_id),
          hasRoomId: Boolean(notificationCore.room_id),
          validType: ["join_request", "room_switch"].includes(notificationCore.type)
        }
      });
      return NextResponse.json({ 
        error: "Invalid notification data",
        details: "The notification data is missing required fields or contains invalid values"
      }, { status: 400 });
    }

    const validatedNotificationCore = notificationCore as NotificationCore;

    // Fetch sender data with error handling
    const { data: senderData, error: senderError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", validatedNotificationCore.sender_id)
      .single();

    if (senderError || !senderData) {
      console.error("[Notifications Accept] Sender fetch error:", {
        error: senderError?.message,
        senderId: validatedNotificationCore.sender_id
      });
      return NextResponse.json({ 
        error: "Sender not found",
        details: senderError?.message || "Unable to fetch sender information"
      }, { status: 404 });
    }

    // Fetch recipient data with error handling
    const { data: recipientData, error: recipientError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", validatedNotificationCore.user_id)
      .single();

    if (recipientError || !recipientData) {
      console.error("[Notifications Accept] Recipient fetch error:", {
        error: recipientError?.message,
        recipientId: validatedNotificationCore.user_id
      });
      return NextResponse.json({ 
        error: "Recipient not found",
        details: recipientError?.message || "Unable to fetch recipient information"
      }, { status: 404 });
    }

    // Fetch room data with error handling
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_at, created_by, is_private")
      .eq("id", validatedNotificationCore.room_id)
      .single();

    if (roomError || !roomData) {
      console.error("[Notifications Accept] Room fetch error:", {
        error: roomError?.message,
        roomId: validatedNotificationCore.room_id
      });
      return NextResponse.json({ 
        error: "Room not found",
        details: roomError?.message || "Unable to fetch room information"
      }, { status: 404 });
    }

    // Verify user is the room creator
    if (roomData.created_by !== session.user.id) {
      console.error("[Notifications Accept] Unauthorized: Not the room creator", {
        roomCreator: roomData.created_by,
        requestUser: session.user.id
      });
      return NextResponse.json({ 
        error: "Only the room creator can accept requests",
        details: "You must be the room creator to accept join requests"
      }, { status: 403 });
    }

    // Transaction: Update room_participants, add to room_members, update notification
    const transaction = async () => {
      try {
        // Update room_participants with proper typing
        const { error: participantError } = await supabase
          .from("room_participants")
          .update({ 
            status: "accepted" as const,
            joined_at: timestamp, // This needs to be string
            active: true
          })
          .eq("room_id", validatedNotificationCore.room_id)
          .eq("user_id", validatedNotificationCore.sender_id);

        if (participantError) {
          throw new Error(`Failed to update room_participants: ${participantError.message}`);
        }

        // Add to room_members with proper typing
        const { error: membershipError } = await supabase
          .from("room_members")
          .upsert(
            {
              room_id: validatedNotificationCore.room_id,
              user_id: validatedNotificationCore.sender_id,
              status: "accepted",
              joined_at: timestamp, // This can be string | null
              active: true,
              updated_at: timestamp
            },
            { 
              onConflict: "room_id,user_id",
              ignoreDuplicates: false 
            }
          );

        if (membershipError) {
          // Rollback: Revert room_participants to pending
          await supabase
            .from("room_participants")
            .update({ 
              status: "pending" as const,
              joined_at: timestamp, // Keep the timestamp for audit
              active: false
            })
            .eq("room_id", validatedNotificationCore.room_id)
            .eq("user_id", validatedNotificationCore.sender_id);
          
          throw new Error(`Failed to add to room_members: ${membershipError.message}`);
        }

        // Update notification status
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ 
            status: "read", 
            join_status: "accepted"
          })
          .eq("id", notificationId);

        if (updateError) {
          // Rollback: Remove from room_members and revert room_participants
          await supabase
            .from("room_members")
            .delete()
            .eq("room_id", validatedNotificationCore.room_id)
            .eq("user_id", validatedNotificationCore.sender_id);

          await supabase
            .from("room_participants")
            .update({ 
              status: "pending" as const,
              joined_at: timestamp, // Keep the timestamp for audit
              active: false
            })
            .eq("room_id", validatedNotificationCore.room_id)
            .eq("user_id", validatedNotificationCore.sender_id);

          throw new Error(`Failed to update notification: ${updateError.message}`);
        }

        // Send acceptance notification
        const message = `Your request to ${validatedNotificationCore.type === "join_request" ? "join" : "switch to"} ${roomData.name} was accepted`;
        const { error: acceptNotificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: validatedNotificationCore.sender_id,
            type: validatedNotificationCore.type === "join_request" ? "user_joined" : "room_switch_accepted",
            room_id: validatedNotificationCore.room_id,
            sender_id: session.user.id,
            message,
            status: "unread",
            created_at: new Date().toISOString(),
            direct_chat_id: null,
          });

        if (acceptNotificationError) {
          console.error(
            "[Notifications Accept] Error sending acceptance notification:",
            acceptNotificationError.message,
            { 
              notificationData: { 
                user_id: validatedNotificationCore.sender_id, 
                room_id: validatedNotificationCore.room_id 
              } 
            }
          );
          // Non-critical error, continue without rollback
        }

      } catch (error) {
        console.error("[Notifications Accept] Transaction failed:", {
          error,
          notification: validatedNotificationCore,
          timestamp
        });
        throw error;
      }
    };

    await transaction();

    // Construct updated notification for response
    const notification = {
      ...validatedNotificationCore,
      join_status: "accepted",
      status: "read",
      users: senderData,
      recipient: recipientData,
      rooms: roomData,
      direct_chat_id: validatedNotificationCore.direct_chat_id,
    };

    const transformedNotification = transformNotification(notification);

    return NextResponse.json(
      { 
        message: "Request accepted successfully", 
        notification: transformedNotification 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("[Notifications Accept] Server error:", {
      error,
      notificationId: params.notificationId,
      timestamp,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "An unexpected error occurred",
        requestId: Math.random().toString(36).substring(7)
      },
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
      "Content-Type": "application/json"
    } 
  });
}

export async function GET() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}

export async function POST() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}

export async function DELETE() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}

export async function PUT() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}