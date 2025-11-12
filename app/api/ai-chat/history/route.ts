import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) {
      return NextResponse.json({ success: false, error: "Missing roomId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ai_chat_history")
      .select("user_query, ai_response, created_at, model_used")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const messages = data.flatMap((m) => [
      {
        id: `${m.created_at}-user`,
        role: "user",
        content: m.user_query,
        timestamp: m.created_at,
      },
      {
        id: `${m.created_at}-ai`,
        role: "assistant",
        content: m.ai_response,
        timestamp: m.created_at,
        model: m.model_used,
      },
    ]);

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    console.error("[AI History Error]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
