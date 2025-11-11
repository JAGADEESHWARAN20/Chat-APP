// app/api/summarize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import type { Database } from "@/lib/types/supabase";

// -------------------- Schema --------------------
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("gpt-4o-mini"),
  maxTokens: z.number().min(50).max(3000).default(1500),
  temperature: z.number().min(0).max(1).default(0.2),
});

// -------------------- Env / constants --------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const REFERRER = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const APP_TITLE = "FlyCode Chat AI Assistant";

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY. Add it to environment variables.");
}

// Supabase server client (service role key)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// -------------------- Helpers --------------------
async function fetchOpenRouter(payload: any, timeoutMs = 20000) {
  // Abort controller for timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // Use correct header names; OpenRouter enforces referer/origin if configured
        Referer: REFERRER,
        Origin: REFERRER,
        "X-Title": APP_TITLE,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Read body text (we may need JSON or plain text)
    const text = await res.text();
    if (!res.ok) {
      // Try parse JSON error, otherwise show raw text
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { error: text || `status ${res.status}` };
      }
      // Log the OpenRouter returned error for debugging
      console.error("[OpenRouter Error Response]", parsed);
      const msg = parsed?.error?.message || parsed?.message || text || `OpenRouter ${res.status}`;
      const err = new Error(msg);
      // Attach status so call site can decide
      (err as any).status = res.status;
      throw err;
    }

    // Parse the JSON result
    try {
      return JSON.parse(text);
    } catch (e) {
      // If parse fails return raw text inside an object
      return { raw: text };
    }
  } finally {
    clearTimeout(id);
  }
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // if auth error — break early
      if (err?.status === 401 || err?.message?.toLowerCase()?.includes("401") || err?.message?.toLowerCase()?.includes("user not found")) {
        console.error("[OpenRouter Auth Error] 401 detected - aborting retries.");
        throw err;
      }
      if (i === retries) break;
      console.warn(`[Retry ${i + 1}/${retries}] Retrying after error:`, err?.message ?? err);
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr ?? new Error("Retries exhausted");
}

// -------------------- Handler --------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId = "system", model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    console.log("[AI Summarize] Request:", { roomId, userId, model });

    const payload = {
      model,
      messages: [
        { role: "system", content: "You are an AI summarizer. Respond concisely and in JSON/text." },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };

    const completion = await callWithRetry(() => fetchOpenRouter(payload), 2);

    // OpenRouter returns structure similar to: { choices: [{ message: { content: "..." } }] }
    const content =
      (completion?.choices?.[0]?.message?.content as string) ??
      (typeof completion?.raw === "string" ? completion.raw : JSON.stringify(completion));

    // Save attempt to DB; log errors but still return AI output where possible
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

    // If validation error
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    }

    // Specific handling for OpenRouter 401 / user-not-found
    const msg = err?.message || "Internal Server Error";
    if (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("user not found") || msg.toLowerCase().includes("unauthorized")) {
      // Helpful error returned to client and logged for us
      return NextResponse.json({ error: "OpenRouter unauthorized", message: msg }, { status: 401 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
