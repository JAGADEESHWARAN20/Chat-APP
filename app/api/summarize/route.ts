import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { OpenRouter } from "@openrouter/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { ensureSystemUserExists } from "@/lib/init/systemUser";

// 🧱 Validate input
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("openai/gpt-4o"),
});

// 🧩 Supabase (Service Role Key)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🧩 OpenRouter Client (minimal setup)
const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// 🧠 Normalize content
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

    // 🧩 Ensure system user exists before saving
    await ensureSystemUserExists();

    // 🧠 Generate response
    const completion = await openRouter.chat.send({
      model,
      messages: [
        { role: "system", content: "You are a concise, helpful AI summarizer." },
        { role: "user", content: prompt },
      ],
      stream: false,
    });

    const raw = completion?.choices?.[0]?.message?.content ?? "";
    const aiResponse = parseContent(raw);

    // 🗄️ Store in Supabase
    const insertData = {
      id: uuidv4(),
      room_id: roomId,
      user_id: userId,
      user_query: prompt,
      ai_response: aiResponse,
      model_used: model,
      created_at: new Date().toISOString(),
    } satisfies Database["public"]["Tables"]["ai_chat_history"]["Insert"];

    const { error: insertError } = await supabase
      .from("ai_chat_history")
      .insert(insertData);

    if (insertError) {
      console.error("❌ [Supabase Insert Error]", insertError);
      throw new Error("Database insert failed: " + insertError.message);
    }

    console.log("✅ [AI Response Saved]", aiResponse.slice(0, 120));

    return NextResponse.json({ success: true, fullContent: aiResponse });
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
