import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

// PATCH: Reject a join request or room switch notification
export async function PATCH(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const notificationId = params.notificationId;
    console.log(`[Notifications Reject] Processing reject for notification ID: ${notificationId}`);

    // Validate notificationId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!notificationId || !uuidRegex.test(notificationId)) {
      console.error(`[Notifications Reject] Invalid notification ID: ${notificationId}`);
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("[Notifications Reject] Session error:", sessionError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[Notifications Reject] Authenticated user ID: ${session.user.id}`);

    // Fetch the notification to verify it exists, is a join_request or room_switch, and is unread
    const { data: notificationCore, error: notificationCoreError } = await supabase
      .from("notifications")
      .select("id, message, created_at, status, type, sender_id, user_id, room_id, join_status, direct_chat_id")
      .eq("id", notificationId)
      .in("type", ["join_request", "room_switch"])
      .eq("user_id", session.user.id)
      .eq("status", "unread")
      .single();

    if (notificationCoreError || !notificationCore) {
      console.error("[Notifications Reject] Notification fetch error:", notificationCoreError?.message || "Notification not found");
      return NextResponse.json({ error: "Notification not found, not a join request/room switch, or already processed" }, { status: 404 });
    }

    // Fetch related data
    if (!notificationCore.sender_id) {
      console.error("[Notifications Reject] Sender ID is null");
      return NextResponse.json({ error: "Invalid notification data: missing sender_id" }, { status: 400 });
    }
    const { data: senderData, error: senderError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", notificationCore.sender_id)
      .single();
    if (senderError || !senderData) {
      console.error("[Notifications Reject] Sender fetch error:", senderError?.message);
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    if (!notificationCore.user_id) {
      console.error("[Notifications Reject] Recipient ID is null");
      return NextResponse.json({ error: "Invalid notification data: missing user_id" }, { status: 400 });
    }
    const { data: recipientData, error: recipientError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", notificationCore.user_id)
      .single();
    if (recipientError || !recipientData) {
      console.error("[Notifications Reject] Recipient fetch error:", recipientError?.message);
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    if (!notificationCore.room_id) {
      console.error("[Notifications Reject] Room ID is null");
      return NextResponse.json({ error: "Invalid notification data: missing room_id" }, { status: 400 });
    }
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_at, created_by, is_private")
      .eq("id", notificationCore.room_id)
      .single();
    if (roomError || !roomData) {
      console.error("[Notifications Reject] Room fetch error:", roomError?.message);
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify user is the room creator
    if (roomData.created_by !== session.user.id) {
      console.error(`[Notifications Reject] Permission denied: User ${session.user.id} is not the room creator (${roomData.created_by})`);
      return NextResponse.json({ error: "Only the room creator can reject requests" }, { status: 403 });
    }

    // Delete from room_participants
    const { error: participantError } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", notificationCore.room_id)
      .eq("user_id", notificationCore.sender_id);
    if (participantError) {
      console.error("[Notifications Reject] Error deleting from room_participants:", participantError.message);
      return NextResponse.json({ error: "Failed to reject request", details: participantError.message }, { status: 500 });
    }
    console.log(`[Notifications Reject] Deleted user ${notificationCore.sender_id} from room_participants for room ${notificationCore.room_id}`);

    // Ensure the user is not in room_members
    const { error: removeMemberError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", notificationCore.room_id)
      .eq("user_id", notificationCore.sender_id);
    if (removeMemberError) {
      console.error("[Notifications Reject] Error removing from room_members:", removeMemberError.message);
    } else {
      console.log(`[Notifications Reject] Ensured user ${notificationCore.sender_id} is not in room_members for room ${notificationCore.room_id}`);
    }

    // Update the notification's status to 'read' and join_status to 'rejected'
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ status: "read", join_status: "rejected" })
      .eq("id", notificationId);
    if (updateError) {
      console.error("[Notifications Reject] Error updating notification status:", updateError.message);
    } else {
      console.log(`[Notifications Reject] Updated notification ${notificationId}: status to read, join_status to rejected`);
    }

    // Notify the requester that their request was rejected
    const message = `Your request to ${notificationCore.type === "join_request" ? "join" : "switch to"} ${roomData.name} was rejected`;
    const { error: rejectNotificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: notificationCore.sender_id,
        type: notificationCore.type === "join_request" ? "join_request_rejected" : "room_switch_rejected",
        room_id: notificationCore.room_id,
        sender_id: session.user.id,
        message,
        status: "unread",
        created_at: new Date().toISOString(),
        direct_chat_id: null,
      });
    if (rejectNotificationError) {
      console.error("[Notifications Reject] Error sending rejection notification:", rejectNotificationError.message);
    } else {
      console.log(`[Notifications Reject] Sent rejection notification to user ${notificationCore.sender_id}`);
    }

    // Construct the updated notification object for the response
    const notification = {
      ...notificationCore,
      join_status: "rejected",
      status: "read",
      users: senderData,
      recipient: recipientData,
      rooms: roomData,
      direct_chat_id: notificationCore.direct_chat_id,
    };

    // Transform the updated notification
    const transformedNotification = transformNotification(notification);

    return NextResponse.json({ message: "Request rejected", notification: transformedNotification }, { status: 200 });
  } catch (error) {
    console.error("[Notifications Reject] Server error:", error);
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