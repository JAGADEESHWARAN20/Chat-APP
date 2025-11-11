// app/api/summarize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import type { Database } from "@/lib/types/supabase";

// ================= Schema =================
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("gpt-4o-mini"),
  maxTokens: z.number().min(50).max(3000).default(1500),
  temperature: z.number().min(0).max(1).default(0.2),
});

// ================= Env / constants =================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const APP_TITLE = "FlyCode Chat AI Assistant";

// Validate key
if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY in environment.");
}

// Supabase server-side client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ================= Helper function =================
async function callOpenRouter(payload: any, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": APP_TITLE,
      },
      body: JSON.stringify(payload),
    });
    

    const text = await res.text();

    if (!res.ok) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { error: text };
      }
      console.error("[OpenRouter Error Response]", parsed);
      const msg = parsed?.error?.message || parsed?.message || `OpenRouter failed status ${res.status}`;
      const err = new Error(msg);
      (err as any).status = res.status;
      throw err;
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      return { raw: text };
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ================= Handler =================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId = "system", model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    console.log("[AI Summarize] Request:", { roomId, userId, model });

    const payload = {
      model,
      messages: [
        { role: "system", content: "You are an AI summarizer. Respond concisely and clearly." },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };

    const completion = await callOpenRouter(payload);

    const content =
      (completion?.choices?.[0]?.message?.content as string) ??
      (typeof completion?.raw === "string" ? completion.raw : JSON.stringify(completion));

    // Save to DB
    try {
      const { error } = await supabase.from("ai_chat_history").insert({
        id: uuidv4(),
        room_id: roomId,
        user_id: userId,
        user_query: prompt,
        ai_response: content,
        model_used: model,
        created_at: new Date().toISOString(),
      });
      if (error) console.error("[Supabase Insert Error]", error);
    } catch (dbErr) {
      console.error("[Supabase Insert Exception]", dbErr);
    }

    return NextResponse.json({ success: true, fullContent: content });

  } catch (err: any) {
    console.error("[Summarize API Error]", err);
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    }
    const msg = err?.message || "Internal Server Error";
    if (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("user not found") || msg.toLowerCase().includes("unauthorized")) {
      return NextResponse.json({ error: "OpenRouter unauthorized", message: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
