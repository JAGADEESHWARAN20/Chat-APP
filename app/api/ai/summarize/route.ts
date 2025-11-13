// app/api/ai/summarize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { ensureSystemUserExists } from "@/lib/init/systemUser";

export const dynamic = 'force-dynamic';
// ---------------- Schema ----------------
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
  userId: z.string().optional(),
  model: z.string().default("gpt-4o-mini"),
});

// ---------------- Clients ----------------
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// ---------------- AI Response Parser ----------------
function parseContent(raw: unknown): string {
  if (!raw) return "No response received.";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && 'type' in item) {
          if (item.type === "text" && 'content' in item) return String(item.content) ?? "";
          if (item.type === "image_url") return "[Image omitted]";
        }
        return "";
      })
      .join(" ")
      .trim();
  }
  return "Unsupported AI response format.";
}

// ---------------- MAIN HANDLER ----------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { prompt, roomId, userId: rawUserId, model } = SummarizeSchema.parse(body);

    // Use your actual system user ID
    const SYSTEM_USER_ID = "ca9ff56d-a12a-4429-9f62-a78f03e3461c";
    
    const userId = rawUserId && rawUserId.trim() !== "" && rawUserId !== "system" 
      ? rawUserId 
      : SYSTEM_USER_ID;

    console.log("📨 Summarize Request:", { userId, roomId, model });

    // Ensure system user exists
    await ensureSystemUserExists();

    // ---------------- AI GENERATION ----------------
    const completion = await openai.chat.completions.create({
      model: model.startsWith("openai/") ? model : `openai/${model}`,
      messages: [
        { 
          role: "system" as const, 
          content: "You are a helpful, concise AI assistant. Provide clear and useful responses." 
        },
        { role: "user" as const, content: prompt },
      ],
      max_tokens: 2000,
    });

    const message = completion.choices?.[0]?.message?.content ?? "";
    const parsedContent = parseContent(message);
    const tokenCount = completion?.usage?.total_tokens ?? 0;

    // ---------------- SAVE CHAT HISTORY ----------------
    const insertPayload: Database["public"]["Tables"]["ai_chat_history"]["Insert"] = {
      id: uuidv4(),
      room_id: roomId,
      user_id: userId,
      user_query: prompt,
      ai_response: parsedContent,
      model_used: model,
      token_count: tokenCount,
      message_count: 2,
      analysis_type: "general",
      structured_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("ai_chat_history")
      .insert(insertPayload);

    if (insertError) {
      console.error("❌ Supabase Insert Error:", insertError.message);
      console.warn("Continuing without saving to DB...");
    } else {
      console.log("✅ Chat Saved to DB");
    }

    return NextResponse.json({
      success: true,
      fullContent: parsedContent,
      meta: { tokens: tokenCount, model },
    });

  } catch (err: unknown) {
    console.error("💥 Summarize Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    const errorDetails = err instanceof z.ZodError ? err.issues : null;
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

// import { NextRequest, NextResponse } from "next/server";
// import { z } from "zod";
// import OpenAI from "openai";
// import { v4 as uuidv4 } from "uuid";
// import { createClient as createServerClient } from "@supabase/supabase-js";
// import { Database } from "@/lib/types/supabase";
// import { SYSTEM_USER_ID } from "@/lib/init/systemUser";

// const SummarizeSchema = z.object({
//   prompt: z.string().min(1).max(15000),
//   roomId: z.string().min(1),
//   model: z.string().default("gpt-4o-mini"),
// });

// const openai = new OpenAI({
//   baseURL: "https://openrouter.ai/api/v1",
//   apiKey: process.env.OPENROUTER_API_KEY!,
// });

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { prompt, roomId, model } = SummarizeSchema.parse(body);

//     // ✔ Server-auth Supabase client
//     const supabase = createServerClient<Database>(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.SUPABASE_SERVICE_ROLE_KEY!
//     );

//     // ✔ Correct authenticated user from Supabase session cookies
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();

//     const userId = user?.id ?? SYSTEM_USER_ID;

//     console.log("📨 AI Summarize:", { userId, roomId, model });

//     // ---------------- AI ----------------
//     const completion = await openai.chat.completions.create({
//       model,
//       messages: [
//         { role: "system", content: "You are a helpful assistant." },
//         { role: "user", content: prompt },
//       ],
//     });

//     const content =
//       completion.choices?.[0]?.message?.content || "No response.";
//     const tokens = completion.usage?.total_tokens ?? 0;

//     // ---------------- Save history ----------------
//     const payload = {
//       id: uuidv4(),
//       room_id: roomId,
//       user_id: userId,
//       user_query: prompt,
//       ai_response: content,
//       model_used: model,
//       token_count: tokens,
//       message_count: 2,
//       analysis_type: "general",
//       structured_data: {},
//       created_at: new Date().toISOString(),
//       updated_at: new Date().toISOString(),
//     };

//     await supabase.from("ai_chat_history").insert(payload);

//     return NextResponse.json({
//       success: true,
//       fullContent: content,
//       meta: { tokens, model },
//     });
//   } catch (err: any) {
//     console.error("💥 Summarize Error:", err);
//     return NextResponse.json(
//       { success: false, error: err.message },
//       { status: 500 }
//     );
//   }
// }
