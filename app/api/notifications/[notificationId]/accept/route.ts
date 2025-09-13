// /app/api/notifications/[notificationId]/accept/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const notificationId = params.notificationId;

    // ✅ Auth check
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    // ✅ Fetch notification
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();
    if (notifError || !notif) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // ✅ Only handle join_request notifications
    if (notif.type !== "join_request") {
      return NextResponse.json({ error: "Not a join request" }, { status: 400 });
    }

    // ✅ Ensure current user is the recipient (room owner)
    if (notif.user_id !== currentUserId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    if (!notif.sender_id || !notif.room_id) {
      return NextResponse.json({ error: "Missing sender_id or room_id" }, { status: 400 });
    }

    // ✅ Call RPC to accept
    const { error: funcError } = await supabase.rpc("accept_notification", {
      p_notification_id: notificationId,
      p_target_user_id: currentUserId,
    });
    if (funcError) {
      return NextResponse.json({ error: funcError.message }, { status: 500 });
    }

    // ✅ Fetch updated room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .eq("id", notif.room_id)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found after acceptance" }, { status: 404 });
    }

    // ✅ Count accepted members
    const { count: memberCount } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", notif.room_id)
      .eq("status", "accepted");

    return NextResponse.json({
      success: true,
      message: "Join request accepted successfully",
      room,
      memberCount: memberCount ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
