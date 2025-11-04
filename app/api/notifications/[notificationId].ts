import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

// DELETE /api/notifications/[notificationId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const notificationId = params.notificationId;

  // Auth check
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow deletion for your own notifications
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", session.user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Deleted." });
}
