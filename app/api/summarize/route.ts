import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { estimateTokens } from "@/lib/token-utils";
import type { Database } from "@/lib/types/supabase";

// ====================== SCHEMA VALIDATION ======================
const SummarizeSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(15000, "Prompt too long"),
  roomId: z.string().min(1, "Room ID required"),
  userId: z.string().optional(),
  model: z
    .enum([
      "gpt-3.5-turbo",
      "gpt-4o-mini",
      "minimax/minimax-m2",
      "andromeda/alpha",
      "tongyi/deepresearch-30b-a3b",
      "meituan/longcat-flash-chat",
      "nvidia/nemotron-nano-9b-v2",
      "deepseek/deepseek-v3-1",
      "openai/gpt-oss-20b",
      "z-ai/glm-4-5-air",
      "qwen/qwen3-coder-480b-a35b",
      "moonshot/kimi-k2-0711",
    ])
    .default("gpt-4o-mini"),
  maxTokens: z.number().min(100).max(3000).default(1500),
  temperature: z.number().min(0).max(1).default(0.2),
});

// ====================== MODEL TOKEN LIMITS ======================
const modelLimits = {
  "gpt-3.5-turbo": 4096,
  "gpt-4o-mini": 128000,
  "minimax/minimax-m2": 205000,
  "andromeda/alpha": 128000,
  "tongyi/deepresearch-30b-a3b": 131000,
  "meituan/longcat-flash-chat": 131000,
  "nvidia/nemotron-nano-9b-v2": 128000,
  "deepseek/deepseek-v3-1": 164000,
  "openai/gpt-oss-20b": 131000,
  "z-ai/glm-4-5-air": 131000,
  "qwen/qwen3-coder-480b-a35b": 262000,
  "moonshot/kimi-k2-0711": 33000,
} as const;

// ====================== CLIENT INITIALIZATION ======================
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    "X-Title": "FlyCode Chat AI Assistant",
  },
});

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ====================== UTILITIES ======================
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.code === 401 || err?.error?.code === 401) {
        console.error("[OpenRouter Auth Error] API key invalid or missing headers.");
        throw new Error("Unauthorized OpenRouter request");
      }
      if (i === maxRetries - 1) throw err;
      console.warn(`[Retry ${i + 1}/${maxRetries}] Retrying after error:`, err);
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw new Error("Retry limit exceeded");
}

interface StructuredAnalysis {
  type: string;
  title: string;
  summary: string;
  sections: { title: string; content: string; metrics?: string[]; highlights?: string[] }[];
  keyFindings: string[];
  recommendations: string[];
  metadata: { participantCount: number; messageCount: number; timeRange: string; sentiment: string };
}

// ====================== MAIN HANDLER ======================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId = "system", model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    console.log("[AI Summarize] Request:", { roomId, userId, model });

    const promptTokens = estimateTokens(prompt);
    const maxInputTokens =
      modelLimits[model as keyof typeof modelLimits] - maxTokens - 200;

    let finalPrompt = prompt;
    if (promptTokens > maxInputTokens) {
      finalPrompt =
        prompt
          .split("\n")
          .slice(-Math.floor(prompt.split("\n").length * 0.6))
          .join("\n") + "\n[Context trimmed for token optimization]";
    }

    const completion = await callWithRetry(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are an AI summarizer. Respond concisely and in JSON." },
          { role: "user", content: finalPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      })
    );

    const content = completion.choices?.[0]?.message?.content?.trim() || "No output";

    const structuredData: StructuredAnalysis = {
      type: "analysis",
      title: "AI Summary",
      summary: content.slice(0, 180),
      sections: [{ title: "Generated Output", content }],
      keyFindings: [],
      recommendations: [],
      metadata: {
        participantCount: 0,
        messageCount: 0,
        timeRange: "N/A",
        sentiment: "Neutral",
      },
    };

    const { error } = await supabase.from("ai_chat_history").insert({
      id: uuidv4(),
      room_id: roomId,
      user_id: userId,
      user_query: prompt,
      ai_response: content,
      model_used: model,
      structured_data: JSON.parse(JSON.stringify(structuredData)),
      created_at: new Date().toISOString(),
    });

    if (error) console.error("[Supabase Insert Error]", error);

    return NextResponse.json({
      success: true,
      model,
      userId,
      roomId,
      structuredData,
      fullContent: content,
    });
  } catch (err: any) {
    console.error("[Summarize API Error]", err);
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal Server Error", message: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
