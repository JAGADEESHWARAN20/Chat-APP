import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: cookieStore.getAll, setAll: () => {} } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notificationId = params.notificationId;
  const { room_id, sender_id } = await req.json();

  if (!room_id || !sender_id)
    return NextResponse.json({ error: "Missing room_id or sender_id" }, { status: 400 });

  const { error } = await supabase.rpc("reject_notification", {
    p_notification_id: notificationId,
    p_room_id: room_id,
    p_sender_id: sender_id,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}


