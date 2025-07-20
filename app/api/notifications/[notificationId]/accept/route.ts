import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

// POST /api/notifications/[notificationId]/accept
export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const notificationId = params.notificationId;

  // Auth check
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerUserId = session.user.id;

  // Fetch notification data (needed for sender id and room id)
  const { data: notif } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (!notif)
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });

  if (notif.type !== "join_request")
    return NextResponse.json({ error: "Not a join request" }, { status: 400 });

  if (notif.user_id !== ownerUserId)
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  // Accept the request by calling your Supabase function
  const now = new Date().toISOString();
  const { error: funcError } = await supabase.rpc("accept_notification", {
    p_notification_id: notificationId,
    p_target_user_id: notif.sender_id,
    p_room_id: notif.room_id,
    p_timestamp: now,
  });

  if (funcError)
    return NextResponse.json({ error: funcError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
