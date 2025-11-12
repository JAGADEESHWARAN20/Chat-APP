import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { OpenRouter } from "@openrouter/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { ensureSystemUserExists } from "@/lib/init/systemUser";


// 🧱 Input schema validation
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"),
  maxTokens: z.number().min(50).max(3000).default(1500),
  temperature: z.number().min(0).max(1).default(0.2),
});

// 🧩 OpenRouter client
const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// 🧩 Supabase (Service Role Key)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🧠 Utility to clean up AI message content
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

// ✅ Main route handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId: rawUserId, model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
    const userId =
      rawUserId && rawUserId.trim() !== "" && rawUserId !== "system"
        ? rawUserId
        : SYSTEM_USER_ID;

    console.log("📨 [Summarize Request]", {
      model,
      userId,
      roomId,
    });

    // 🧠 Query OpenRouter
    const response = await openRouter.chat.send(
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI summarizer. Keep responses clear, factual, and short.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens,
        temperature,
        stream: false,
      },
      {
        headers: {
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL ?? "https://flychatapp.vercel.app",
          "X-Title": "FlyChat AI Assistant",
        },
      }
    );

    const raw = response?.choices?.[0]?.message?.content ?? "";
    const content = parseContent(raw);
    await ensureSystemUserExists();

    // 🗄️ Save to Supabase
    const insertData = {
      id: uuidv4(),
      room_id: roomId,
      user_id: userId,
      user_query: prompt,
      ai_response: content,
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

    console.log("✅ [AI Response Saved]", content.slice(0, 120));
    return NextResponse.json({ success: true, fullContent: content });
  } catch (err: unknown) {
    console.error("💥 [Summarize Error]", err);

    // 🩹 Always coerce into string message (prevents function-type mismatch)
    const errMessage =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Internal Server Error";

    // 🧩 Auto fallback if unauthorized
    if (errMessage.toLowerCase().includes("unauthorized")) {
      try {
        const fallback = await openRouter.chat.send({
          model: "mistralai/mistral-nemo:free",
          messages: [
            { role: "system", content: "Summarize briefly and accurately:" },
            {
              role: "user",
              content: `Fallback request due to: ${errMessage}`,
            },
          ],
        });

        const content = parseContent(
          fallback?.choices?.[0]?.message?.content ?? ""
        );

        return NextResponse.json({
          success: true,
          fullContent: `⚠️ Fallback model used:\n${content}`,
        });
      } catch (fallbackErr) {
        console.error("💥 [Fallback Error]", fallbackErr);
      }
    }

    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 500 }
    );
  }
}
