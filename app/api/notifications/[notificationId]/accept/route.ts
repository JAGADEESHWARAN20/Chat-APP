// app/api/notifications/[notificationId]/accept/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { notificationId } = params;

  // ✅ Auth check
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerUserId = session.user.id;

  // ✅ Fetch notification
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

  if (notif.user_id !== ownerUserId) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // ✅ Ensure required fields exist
  if (!notif.sender_id || !notif.room_id) {
    return NextResponse.json(
      { error: "Notification is missing sender_id or room_id." },
      { status: 400 }
    );
  }

  // ✅ Call Postgres function
  const now = new Date().toISOString();
  const { error: funcError } = await supabase.rpc("accept_notification", {
    p_notification_id: notificationId,
    p_target_user_id: notif.sender_id,
    p_room_id: notif.room_id,
    p_timestamp: now,
  });

  if (funcError) {
    return NextResponse.json({ error: funcError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
