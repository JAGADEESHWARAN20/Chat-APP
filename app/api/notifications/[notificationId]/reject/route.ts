// /app/api/notifications/reject/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();

  const { notificationId, senderId, roomId } = body;

  if (!notificationId || !senderId || !roomId) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const { error } = await supabase.rpc("reject_notification", {
    p_notification_id: notificationId,
    p_sender_id: senderId,
    p_room_id: roomId,
    // Optional timestamp if needed:
    // p_timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error("Reject RPC Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Join request rejected successfully" });
}
