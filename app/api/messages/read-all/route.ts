import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Database } from "@/lib/types/supabase";

const schema = z.object({ messageIds: z.array(z.string().uuid()) });

export async function POST(req: NextRequest) {
  console.time('messages-read-all');
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messageIds } = schema.parse(await req.json());

    const { error } = await supabase.rpc("batch_mark_messages_read", {
      p_message_ids: messageIds,
      p_user_id: session.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    console.timeEnd('messages-read-all');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.timeEnd('messages-read-all');
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}