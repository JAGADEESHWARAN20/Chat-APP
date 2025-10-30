import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notificationId = params.notificationId;
  const userId = session.user.id;

  try {
    // Call your Supabase function for accepting join requests
    const { error } = await supabase.rpc("accept_notification", {
      p_notification_id: notificationId,
      p_target_user_id: userId,
    });

    if (error) {
      console.error("❌ Supabase RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("💥 Error in accept route:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
