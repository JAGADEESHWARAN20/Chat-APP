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

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();
    if (notifError || !notif) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notif.type !== "join_request") {
      return NextResponse.json({ error: "Not a join request" }, { status: 400 });
    }

    if (notif.user_id !== currentUserId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    if (!notif.sender_id || !notif.room_id) {
      return NextResponse.json({ error: "Missing sender_id or room_id" }, { status: 400 });
    }

    let retries = 2;
    while (retries >= 0) {
      const { error: funcError } = await supabase.rpc("accept_notification", {
        p_notification_id: notificationId,
        p_target_user_id: currentUserId,
      });
      if (!funcError) break;
      if (retries === 0) return NextResponse.json({ error: funcError.message }, { status: 500 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries--;
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .eq("id", notif.room_id)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found after acceptance" }, { status: 404 });
    }

    const { count: memberCount } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", notif.room_id)
      .eq("status", "accepted");
    const { count: participantCount } = await supabase
      .from("room_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", notif.room_id)
      .eq("status", "accepted");
    const totalMemberCount = (memberCount ?? 0) + (participantCount ?? 0);

    return NextResponse.json({
      success: true,
      message: "Join request accepted successfully",
      room,
      memberCount: totalMemberCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}