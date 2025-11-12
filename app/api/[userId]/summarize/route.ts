import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { ensureSystemUserExists } from "@/lib/init/systemUser";

// ============================================================
// 🧱 1️⃣ Schema Validation
// ============================================================
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("openai/gpt-4o"),
});

// ============================================================
// 🧩 2️⃣ Supabase Client (Service Role)
// ============================================================
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// 🤖 3️⃣ OpenRouter Client (OpenAI-Compatible)
// ============================================================
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// ============================================================
// 🧠 4️⃣ Utility - Parse AI Output Safely
// ============================================================
function parseContent(raw: unknown): string {
  if (!raw) return "No response received.";
  if (typeof raw === "string") return raw;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.type === "text") return item.content ?? "";
        if (item?.type === "image_url") return "[Image omitted]";
        return "";
      })
      .join(" ")
      .trim();
  }

  return "Unsupported AI response format.";
}

// ============================================================
// 🚀 5️⃣ API Route: POST /api/[userId]/summarize
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // 🧩 Parse and validate input
    const body = await req.json();
    const { prompt, roomId, model } = SummarizeSchema.parse(body);

    const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
    const userId =
      params.userId && params.userId.trim() !== "" && params.userId !== "system"
        ? params.userId
        : SYSTEM_USER_ID;

    console.log("📨 [Summarize Request]", { model, userId, roomId });

    // ✅ Ensure system user exists (for system fallbacks)
    await ensureSystemUserExists();

    // ✅ Ensure this user exists in Supabase (fixes "User not found" foreign key errors)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      await supabase.from("users").insert({
        id: userId,
        username: "guest_user",
        display_name: "Anonymous User",
        avatar_url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Guest",
        created_at: new Date().toISOString(),
      });
      console.log(`👤 [Created Placeholder User] ${userId}`);
    }

    // 🧠 Query AI Model via OpenRouter (OpenAI compatible)
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a concise, helpful AI summarizer." },
        { role: "user", content: prompt },
      ],
    });

    // 🧩 Extract content safely
    const content = parseContent(completion.choices?.[0]?.message?.content ?? "");

    // 💾 Save to Supabase
    const { error: insertError } = await supabase
      .from("ai_chat_history")
      .insert({
        id: uuidv4(),
        room_id: roomId,
        user_id: userId,
        user_query: prompt,
        ai_response: content,
        model_used: model,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("❌ [Supabase Insert Error]", insertError);
      throw new Error("Database insert failed: " + insertError.message);
    }

    console.log("✅ [AI Response Saved]", content.slice(0, 100));
    return NextResponse.json({ success: true, fullContent: content });
  } catch (err: unknown) {
    console.error("💥 [Summarize Error]", err);

    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Internal Server Error";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
