import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/supabase";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { roomId, content, userId } = await req.json();

    if (!roomId || !content || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        text: content,
        room_id: roomId,
        sender_id: userId,        // ✅ correct column
        created_at: new Date().toISOString(),
        status: "sent",
        is_edited: false,
        direct_chat_id: null,
        dm_thread_id: null,
      })
      .select(`
        id,
        text,
        sender_id,
        created_at,
        is_edited,
        room_id,
        direct_chat_id,
        dm_thread_id,
        status,
        profiles:profiles!sender_id (
          id,
          username,
          display_name,
          avatar_url,
          created_at,
          updated_at,
          bio
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ message });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
