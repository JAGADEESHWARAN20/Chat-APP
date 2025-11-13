// app/api/ai-chat/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
// Or alternatively, you can disable caching
export const revalidate = 0;

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
}

interface ApiResponse {
  success: boolean;
  messages?: ChatMessage[];
  error?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Use req.url directly without destructuring to avoid static optimization
    const url = new URL(req.url);
    const roomId = url.searchParams.get("roomId");
    
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: "Missing roomId" }, 
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_chat_history")
      .select("user_query, ai_response, created_at, model_used")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Transform data for frontend
    const messages: ChatMessage[] = (data || []).flatMap((m, index) => [
      {
        id: `${m.created_at}-user-${index}`,
        role: "user" as const,
        content: m.user_query,
        timestamp: new Date(m.created_at!),
      },
      {
        id: `${m.created_at}-ai-${index}`,
        role: "assistant" as const,
        content: m.ai_response,
        timestamp: new Date(m.created_at!),
        model: m.model_used || undefined,
      },
    ]);

    return NextResponse.json({ 
      success: true, 
      messages 
    });

  } catch (err: unknown) {
    console.error("[AI History Error]", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}