import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { ensureSystemUserExists } from "@/lib/init/systemUser";

// 🧱 Input schema
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("openai/gpt-4o"),
});

// 🧩 Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🧩 OpenRouter (OpenAI-compatible) client
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// 🧠 Normalize AI output
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

// ✅ POST route
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId: rawUserId, model } =
      SummarizeSchema.parse(body);

    const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
    const userId =
      rawUserId && rawUserId.trim() !== "" && rawUserId !== "system"
        ? rawUserId
        : SYSTEM_USER_ID;

    console.log("📨 [Summarize Request]", { model, userId, roomId });

    // Ensure system user exists before insert
    await ensureSystemUserExists();

    // 🧠 Generate AI response using OpenRouter's OpenAI-compatible endpoint
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a concise, helpful AI summarizer." },
        { role: "user", content: prompt },
      ],
    });

    const content = parseContent(completion.choices?.[0]?.message?.content ?? "");

    // Ensure user exists before insert
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
}

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

    console.log("✅ [AI Response Saved]", content.slice(0, 120));

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
