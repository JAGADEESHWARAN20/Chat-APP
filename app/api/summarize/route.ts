import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
// import { estimateTokens } from "@/lib/token-utils";
import type { Database } from "@/lib/types/supabase";

const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("gpt-4o-mini"),
  maxTokens: z.number().min(100).max(3000).default(1500),
  temperature: z.number().min(0).max(1).default(0.2),
});

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const REFERER =
  process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "https://localhost";
const APP_TITLE = "FlyCode Chat AI Assistant";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.message?.includes("401")) throw err;
      if (i === retries - 1) throw err;
      console.warn(`[Retry ${i + 1}] Retrying after error:`, err);
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error("Retry limit exceeded");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId = "system", model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    console.log("[AI Summarize] Request:", { roomId, userId, model });

    const completion = await callWithRetry(async () => {
      const res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "Referer": REFERER,
          "Origin": REFERER,
          "X-Title": APP_TITLE,
        },
        
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are an AI summarizer. Respond concisely and clearly." },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[OpenRouter Error Response]", text);
        throw new Error(`OpenRouter request failed (${res.status})`);
      }

      return res.json();
    });

    const content =
      completion?.choices?.[0]?.message?.content?.trim() || "No output";

    await supabase.from("ai_chat_history").insert({
      id: uuidv4(),
      room_id: roomId,
      user_id: userId,
      user_query: prompt,
      ai_response: content,
      model_used: model,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      fullContent: content,
      model,
      userId,
      roomId,
    });
  } catch (err: any) {
    console.error("[Summarize API Error]", err);
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
