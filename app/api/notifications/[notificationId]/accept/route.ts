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
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const notificationId = params.notificationId;

    // Validate notificationId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!notificationId || !uuidRegex.test(notificationId)) {
      console.error(`[Notifications Accept] Invalid notification ID: ${notificationId}`);
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("[Notifications Accept] Session error:", sessionError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch notification
    const { data: notificationCore, error: notificationCoreError } = await supabase
      .from("notifications")
      .select("id, message, created_at, status, type, sender_id, user_id, room_id, join_status, direct_chat_id")
      .eq("id", notificationId)
      .in("type", ["join_request", "room_switch"])
      .eq("user_id", session.user.id)
      .eq("status", "unread")
      .single();
    if (notificationCoreError || !notificationCore) {
      console.error("[Notifications Accept] Notification fetch error:", notificationCoreError?.message);
      return NextResponse.json(
        { error: "Notification not found, not a join request/room switch, or already processed" },
        { status: 404 }
      );
    }

    // Validate notification data and narrow types
    if (
      !notificationCore.sender_id ||
      !notificationCore.user_id ||
      !notificationCore.room_id ||
      typeof notificationCore.sender_id !== "string" ||
      typeof notificationCore.user_id !== "string" ||
      typeof notificationCore.room_id !== "string" ||
      notificationCore.status === null ||
      (notificationCore.type !== "join_request" && notificationCore.type !== "room_switch")
    ) {
      console.error("[Notifications Accept] Invalid notification data:", notificationCore);
      return NextResponse.json({ error: "Invalid notification data" }, { status: 400 });
    }
    // Type assertion to ensure type safety
    const validatedNotificationCore = notificationCore as NotificationCore;

    const { data: senderData, error: senderError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", validatedNotificationCore.sender_id)
      .single();
    if (senderError || !senderData) {
      console.error("[Notifications Accept] Sender fetch error:", senderError?.message);
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    const { data: recipientData, error: recipientError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", validatedNotificationCore.user_id)
      .single();
    if (recipientError || !recipientData) {
      console.error("[Notifications Accept] Recipient fetch error:", recipientError?.message);
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_at, created_by, is_private")
      .eq("id", validatedNotificationCore.room_id)
      .single();
    if (roomError || !roomData) {
      console.error("[Notifications Accept] Room fetch error:", roomError?.message);
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify user is the room creator
    if (roomData.created_by !== session.user.id) {
      console.error("[Notifications Accept] Unauthorized: Not the room creator");
      return NextResponse.json({ error: "Only the room creator can accept requests" }, { status: 403 });
    }

    // Transaction: Update room_participants, add to room_members, update notification
    const transaction = async () => {
      try {
        // Update room_participants
        const { error: participantError } = await supabase
          .from("room_participants")
          .update({ status: "accepted", joined_at: new Date().toISOString() })
          .eq("room_id", validatedNotificationCore.room_id)
          .eq("user_id", validatedNotificationCore.sender_id);
        if (participantError) {
          throw new Error(`Failed to update room_participants: ${participantError.message}`);
        }

        // Add to room_members
        const { error: membershipError } = await supabase
          .from("room_members")
          .upsert(
            [
              {
                room_id: validatedNotificationCore.room_id,
                user_id: validatedNotificationCore.sender_id,
                status: "accepted",
                joined_at: new Date().toISOString(),
                active: false,
              },
            ],
            { onConflict: "room_id,user_id" }
          );
        if (membershipError) {
          // Rollback: Revert room_participants to pending
          await supabase
            .from("room_participants")
            .update({ status: "pending", joined_at: undefined })
            .eq("room_id", validatedNotificationCore.room_id)
            .eq("user_id", validatedNotificationCore.sender_id);
          throw new Error(`Failed to add to room_members: ${membershipError.message}`);
        }

        // Update notification
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ status: "read", join_status: "accepted" })
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
            .update({ status: "pending", joined_at: undefined })
            .eq("room_id", validatedNotificationCore.room_id)
            .eq("user_id", validatedNotificationCore.sender_id);
          throw new Error(`Failed to update notification: ${updateError.message}`);
        }

        // Notify requester
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
            { notificationData: { user_id: validatedNotificationCore.sender_id, room_id: validatedNotificationCore.room_id } }
          );
          // Not critical, so we don't roll back
        }
      } catch (error) {
        console.error("[Notifications Accept] Transaction failed:", error);
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
      { message: "Request accepted", notification: transformedNotification },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Notifications Accept] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Fallback handlers for unsupported methods
export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function POST() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}
export async function PUT() {
  return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } });
}