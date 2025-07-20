import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

// POST /api/notifications/reject
export async function POST(req: NextRequest) {
  const { notification_id, sender_id, room_id } = await req.json();
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // Auth check
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Reject the request by calling your function
  const { error: funcError } = await supabase.rpc("reject_notification", {
    p_notification_id: notification_id,
    p_sender_id: sender_id,
    p_room_id: room_id,
  });

  if (funcError)
    return NextResponse.json({ error: funcError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
