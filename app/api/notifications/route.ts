import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

// DELETE /api/notifications
export async function DELETE(_req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // Auth check
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete all notifications for the authenticated user
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", session.user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Cleared all notifications." });
}
