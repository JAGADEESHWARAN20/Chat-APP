// app/api/ai-chat/save/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { v4 as uuidv4 } from "uuid";

export const dynamic = 'force-dynamic';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      roomId,
      userId,
      prompt,
      aiResponse,
      model = "gpt-4o-mini",
    } = await req.json();

    if (!roomId || !prompt || !aiResponse)
      return new Response("Missing fields", { status: 400 });

    const { error } = await supabase.from("ai_chat_history").insert({
      id: uuidv4(),
      room_id: roomId,
      user_id: userId,
      user_query: prompt,
      ai_response: aiResponse,
      model_used: model,
      token_count: null,
      message_count: 2,
      analysis_type: "general",
      structured_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Database["public"]["Tables"]["ai_chat_history"]["Insert"]);

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}