// /app/api/notifications/[notificationId]/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const notificationId = params.notificationId;
  const timestamp = new Date().toISOString();

  try {
    if (
      !notificationId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)
    ) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // ✅ Auth check
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    // ✅ Fetch the notification
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const { sender_id, room_id, type, user_id } = notification;

    if (type !== "join_request" || !sender_id || !room_id) {
      return NextResponse.json({ error: "Not a valid join request notification" }, { status: 400 });
    }

    if (user_id !== currentUserId) {
      return NextResponse.json({ error: "Unauthorized to act on this notification" }, { status: 403 });
    }

    // ✅ Verify user is the owner of the room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("created_by")
      .eq("id", room_id)
      .single();

    if (roomError || !room || room.created_by !== currentUserId) {
      return NextResponse.json({ error: "Not authorized to accept for this room" }, { status: 403 });
    }

    // ✅ Accept via RPC
    const { error: rpcError } = await supabase.rpc("accept_notification", {
      p_notification_id: notificationId,
      p_target_user_id: sender_id,
      p_room_id: room_id,
      p_timestamp: timestamp,
    });

    if (rpcError) {
      if (rpcError.code === "23505") {
        return NextResponse.json(
          { error: "User is already a member of this room" },
          { status: 409 }
        );
      }

      console.error("[Accept API] RPC Error:", rpcError.message);
      return NextResponse.json(
        { error: "Failed to accept request", details: rpcError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Join request accepted successfully",
      data: { notificationId, roomId: room_id, userId: sender_id, timestamp },
    });
  } catch (error) {
    console.error("[Accept API] Catch Error:", error);
    return NextResponse.json(
      {
        error: "Failed to accept request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}
export async function GET() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}
export async function DELETE() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}
export async function PUT() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}
