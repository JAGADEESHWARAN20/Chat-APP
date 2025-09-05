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

    console.log("[accept_notification] Notification ID:", notificationId);

    // ✅ Auth check
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error("[accept_notification] Authentication error:", sessionError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    console.log("[accept_notification] Current user ID:", currentUserId);

    // ✅ Fetch notification
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notifError || !notif) {
      console.error("[accept_notification] Notification not found:", notifError?.message);
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    console.log("[accept_notification] Notification details:", notif);

    // ✅ Check if it's a join request
    if (notif.type !== "join_request") {
      console.error("[accept_notification] Not a join request:", notif.type);
      return NextResponse.json({ error: "Not a join request" }, { status: 400 });
    }

    // ✅ Check if current user is the notification recipient (room owner)
    if (notif.user_id !== currentUserId) {
      console.error("[accept_notification] Permission denied. Notification user:", notif.user_id, "Current user:", currentUserId);
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    // ✅ Validate required fields
    if (!notif.sender_id || !notif.room_id) {
      console.error("[accept_notification] Missing sender_id or room_id:", notif);
      return NextResponse.json(
        { error: "Notification missing sender_id or room_id" },
        { status: 400 }
      );
    }

    console.log("[accept_notification] Processing join request from user:", notif.sender_id, "for room:", notif.room_id);

    // ✅ Call the updated accept_notification function
    const { error: funcError } = await supabase.rpc("accept_notification", {
      p_notification_id: notificationId,
      p_target_user_id: currentUserId // The room owner who is accepting the request
    });

    if (funcError) {
      console.error("[accept_notification] RPC function error:", funcError.message);
      return NextResponse.json({ error: funcError.message }, { status: 500 });
    }

    console.log("[accept_notification] Successfully processed join request");

    return NextResponse.json({ 
      success: true,
      message: "Join request accepted successfully"
    });

  } catch (err: any) {
    console.error("[accept_notification] Unexpected error:", err.message, err.stack);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}