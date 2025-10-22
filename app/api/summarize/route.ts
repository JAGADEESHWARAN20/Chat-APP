import { NextRequest, NextResponse } from "next/server";
import { z } from "zod"; // npm i zod
import { OpenAI } from "openai"; // npm i openai (OpenRouter-compatible)

// Schema for validation (prevents invalid requests)
const SummarizeSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(10000, "Prompt too long (max 10k chars)"), // Token-safe limit
  model: z.string().optional().default("gpt-3.5-turbo"), // Allow override for paid tiers
});

// OpenRouter client (OpenAI SDK wrapper for simplicity)
const openai = new OpenAI({
  apiKey: process.env.OPEN_ROUTER,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
});

// Enhanced system prompt (prompt engineering: Structured, concise, actionable)
const SYSTEM_PROMPT = `You are an expert conversation summarizer. Analyze the chat log and output ONLY in this JSON format for easy parsing:

{
  "summary": "Concise 2-4 sentence overview of key topics and flow.",
  "key_topics": ["Bullet 1", "Bullet 2"], // 3-5 main themes
  "action_items": ["Action 1: Owner @user", "Action 2: Due date"], // Decisions/tasks with assignees/deadlines
  "tone_sentiment": "Neutral/Positive/Negative" // Overall vibe
}

Keep total output under 500 tokens. Focus on insights, ignore chit-chat. Input: {prompt}`;

export async function POST(req: NextRequest) {
  try {
    // Parse & validate body
    const body = await req.json();
    const { prompt, model = "gpt-3.5-turbo" } = SummarizeSchema.parse(body);

    // Env check (fail-fast)
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
    }

    // Streaming response for better UX (real-time summary as it generates)
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT.replace("{prompt}", prompt) },
        { role: "user", content: prompt },
      ],
      max_tokens: 500, // Cost control
      temperature: 0.3, // Low for factual summaries
      stream: true, // Enable streaming
    });

    // Stream response (client can read incrementally)
    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            controller.enqueue(new TextEncoder().encode(content));
          }
          controller.close();
        } catch (streamErr) {
          controller.error(streamErr);
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache", // Prevent stale summaries
        "Access-Control-Allow-Origin": "*", // CORS if needed
      },
    });

  } catch (validationError) {
    // Zod validation error
    if (validationError instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: validationError.issues },
        { status: 400 }
      );
    }
    // OpenRouter/OpenAI error (e.g., 429 rate limit)
    console.error("API Error:", validationError); // Structured logging (add Winston in prod)
    return NextResponse.json(
      { error: "AI service unavailable", code: (validationError as any).status || 503 },
      { status: 503 }
    );
  }
}