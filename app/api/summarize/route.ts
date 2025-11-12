import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { OpenRouter } from "@openrouter/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"),
  maxTokens: z.number().min(50).max(3000).default(1500),
  temperature: z.number().min(0).max(1).default(0.2),
});

// ✅ OpenRouter client
const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// ✅ Supabase (server key)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId = "system", model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    console.log("📨 [Summarize Request]", { model, userId, roomId });

    // ✅ Correct OpenRouter request (headers moved to 2nd argument)
    const response = await openRouter.chat.send(
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an AI summarizer. Respond with clear, human-like explanations that are short but informative.",
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

    // ✅ Extract AI response
    const raw = response?.choices?.[0]?.message?.content ?? "";
    const content = Array.isArray(raw)
      ? raw
          .map((item: any) => {
            if (typeof item === "string") return item;
            if (item?.type === "text") return item.content ?? "";
            if (item?.type === "image_url") return "[Image omitted]";
            return "";
          })
          .join(" ")
          .trim()
      : typeof raw === "string"
      ? raw
      : "No valid AI response.";

    // ✅ Save to Supabase
    const { error: insertError } = await supabase
      .from("ai_chat_history")
      .insert([
        {
          id: uuidv4(),
          room_id: roomId,
          user_id: userId,
          user_query: prompt,
          ai_response: content,
          model_used: model,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) console.error("❌ Supabase Insert Error:", insertError);

    console.log("✅ AI Response saved:", content.slice(0, 100));
    return NextResponse.json({ success: true, fullContent: content });
  } catch (err: any) {
    console.error("💥 Summarize Error:", err);

    const message =
      typeof err?.message === "string"
        ? err.message
        : JSON.stringify(err) || "Unknown error";

    // 🟡 Fallback to free model if unauthorized
    if (message.toLowerCase().includes("unauthorized")) {
      try {
        const fallback = await openRouter.chat.send({
          model: "mistralai/mistral-nemo:free",
          messages: [
            { role: "system", content: "Summarize briefly:" },
            {
              role: "user",
              content:
                "The main model was unauthorized. Please provide a short summary for: " +
                prompt,
            },
          ],
        });

        const content =
          fallback?.choices?.[0]?.message?.content ?? "Fallback failed.";

        return NextResponse.json({
          success: true,
          fullContent: `⚠️ Fallback model used:\n${content}`,
        });
      } catch (fallbackErr) {
        console.error("💥 Fallback failed:", fallbackErr);
      }
    }

    return NextResponse.json(
      { success: false, error: message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
