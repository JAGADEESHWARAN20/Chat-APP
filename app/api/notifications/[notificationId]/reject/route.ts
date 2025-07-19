// api/notifications/[notificationId]/reject/route.ts (Reject API - PATCH)
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications"; // Ensure correct import

export async function PATCH(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const notificationId = params.notificationId;

    if (!notificationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select(`
        id, message, created_at, status, type, sender_id, user_id, room_id, join_status, direct_chat_id,
        sender:users!notifications_sender_id_fkey(id, username, display_name, avatar_url, created_at),
        recipient:users!notifications_user_id_fkey(id, username, display_name, avatar_url, created_at),
        room:rooms(id, name, created_at, created_by, is_private)
      `)
      .eq("id", notificationId)
      .in("type", ["join_request", "room_switch"]) // Only allow rejection for these types
      .eq("user_id", currentUserId) // Notification must be addressed to the current user (room owner)
      .eq("status", "unread") // Only unread notifications can be rejected
      .single();

    if (notificationError || !notification) {
      console.warn("[Reject API] Notification fetch error or not found:", notificationError?.message || "Not found/already processed");
      return NextResponse.json({ error: "Notification not found, already processed, or not a rejectable type for this user" }, { status: 404 });
    }

    if (!notification.sender_id || !notification.room_id) {
      return NextResponse.json({ error: "Invalid notification data (missing sender or room ID)" }, { status: 400 });
    }

    // Verify current user is the room owner for this request
    const { data: room, error: roomOwnerError } = await supabase
      .from("rooms")
      .select("created_by")
      .eq("id", notification.room_id)
      .single();

    if (roomOwnerError || !room || room.created_by !== currentUserId) {
      console.warn("[Reject API] Authorization failed: current user is not room owner", { currentUserId, roomCreator: room?.created_by });
      return NextResponse.json({ error: "Unauthorized: Only the room creator can reject this request" }, { status: 403 });
    }

    // Call the Supabase RPC to handle rejection logic
    const { error: rpcError } = await supabase.rpc("reject_notification", {
      p_notification_id: notificationId,
      p_sender_id: notification.sender_id, // The user who sent the join request
      p_room_id: notification.room_id,
      p_timestamp: new Date().toISOString()
    });

    if (rpcError) {
      console.error("[Reject API] RPC Error:", rpcError.message);
      return NextResponse.json({ error: "Failed to reject request", details: rpcError.message }, { status: 500 });
    }

    // The RPC should have handled the notification status update.
    // The real-time listener will update the local state.
    // Return a success message.
    return NextResponse.json({ message: "Request rejected successfully" }, { status: 200 });
  } catch (error) {
    console.error("[Reject API] Catch Error:", error);
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: { Allow: "PATCH" } }); }
export async function GET() { return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } }); }
export async function POST() { return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } }); }
export async function DELETE() { return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } }); }
export async function PUT() { return new NextResponse(null, { status: 405, headers: { Allow: "PATCH" } }); }
