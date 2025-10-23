// Fixed /app/api/summarize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { estimateTokens } from '@/lib/token-utils';

// Enhanced Schema with roomId for DB sync
const SummarizeSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(15000, "Prompt too long"),
  roomId: z.string().min(1, "Room ID required for persistence"),
  model: z.enum(["gpt-3.5-turbo", "gpt-4o-mini"]).optional().default("gpt-3.5-turbo"),
  maxTokens: z.number().min(100).max(3000).optional().default(1500),
  temperature: z.number().min(0).max(1).optional().default(0.2),
});

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 SUPERCHARGED PROMPT REFINER WITH FULL RESPONSIVE HTML
class PromptRefiner {
  static refinePrompt(rawPrompt: string): string {
    const userQuery = this.extractUserQuery(rawPrompt);
    const queryType = this.analyzeQueryType(userQuery);
    const refinedQuery = this.refineByQueryType(userQuery, queryType);
    return this.buildEnhancedPrompt(rawPrompt, refinedQuery, queryType);
  }

  // Made public for external access (logging)
  public static extractUserQuery(fullPrompt: string): string {
    const lines = fullPrompt.split("\n");
    const userLines = lines.filter((line) => line.startsWith("user:"));
    return userLines.length > 0
      ? userLines[userLines.length - 1].replace("user:", "").trim()
      : fullPrompt.trim();
  }

  // Made public for external access (logging)
  public static analyzeQueryType(query: string): string {
    const lowerQuery = query.toLowerCase().trim();
    const patterns = {
      USER_ANALYSIS: /who.*(message|contribute|active|participat|engag)/i,
      SUMMARY: /(summary|summarize|overview|recap|tl;dr)/i,
      SENTIMENT: /(sentiment|feel|mood|emotion|tone|vibe)/i,
      TOPIC_ANALYSIS: /(topic|discuss|theme|subject|main point)/i,
      ACTION_ITEMS: /(action|task|todo|decision|follow-up|next step)/i,
      TEMPORAL: /(when|time|date|timeline|chronology|sequence)/i,
      HELP: /(help|what can|capability|feature|how to|guide)/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerQuery)) return type;
    }
    return "GENERAL";
  }

  private static refineByQueryType(query: string, queryType: string): string {
    const refiners: Record<string, (q: string) => string> = {
      USER_ANALYSIS: this.refineUserAnalysisQuery,
      SUMMARY: this.refineSummaryQuery,
      SENTIMENT: this.refineSentimentQuery,
      TOPIC_ANALYSIS: this.refineTopicQuery,
      ACTION_ITEMS: this.refineActionQuery,
      TEMPORAL: this.refineTemporalQuery,
      HELP: this.refineHelpQuery,
      GENERAL: this.refineGeneralQuery,
    };
    return refiners[queryType](query);
  }

  // ADDED MISSING REFINER METHODS
  private static refineUserAnalysisQuery(query: string): string {
    return `Analyze user participation patterns: ${query}. Identify most active users, message frequency, engagement levels, and key contributors with specific metrics.`;
  }

  private static refineSummaryQuery(query: string): string {
    return `Create comprehensive conversation summary: ${query}. Extract key points, decisions, main discussions, and conclusions with timeline context.`;
  }

  private static refineSentimentQuery(query: string): string {
    return `Analyze emotional tone and sentiment: ${query}. Assess overall mood, emotional shifts, positivity/negativity balance, and emotional highlights.`;
  }

  private static refineTopicQuery(query: string): string {
    return `Identify and categorize discussion topics: ${query}. Extract main themes, subtopics, topic transitions, and topic distribution percentages.`;
  }

  private static refineActionQuery(query: string): string {
    return `Extract actionable items and decisions: ${query}. List specific tasks, assignments, deadlines, follow-ups, and decisions made with owners.`;
  }

  private static refineTemporalQuery(query: string): string {
    return `Analyze timeline and chronological patterns: ${query}. Map conversation flow, key events sequence, time-based patterns, and duration analysis.`;
  }

  private static refineHelpQuery(query: string): string {
    return `Provide assistance and guidance: ${query}. Offer clear explanations, step-by-step help, available features, and usage instructions.`;
  }

  private static refineGeneralQuery(query: string): string {
    return `Provide comprehensive analysis: ${query}. Cover key insights, patterns, important information, and actionable intelligence from the conversation.`;
  }

  private static buildEnhancedPrompt(originalContext: string, refinedInstruction: string, queryType: string): string {
    const queryTypeTemplates: Record<string, string> = {
      USER_ANALYSIS: "user-analysis-dashboard",
      SUMMARY: "summary-overview",
      SENTIMENT: "sentiment-analysis",
      TOPIC_ANALYSIS: "topic-breakdown",
      ACTION_ITEMS: "action-items-tracker",
      TEMPORAL: "timeline-visualization",
      HELP: "help-guide",
      GENERAL: "comprehensive-analysis"
    };

    const templateType = queryTypeTemplates[queryType] || "comprehensive-analysis";

    return `CONVERSATION CONTEXT (use this data exclusively):
${originalContext}

USER REQUEST: ${refinedInstruction}

CRITICAL RESPONSE REQUIREMENTS (MANDATORY - VIOLATION = INVALID OUTPUT):
1. RESPOND WITH **ONLY** the EXACT HTML structure for ${templateType} - NO additional text, wrappers, or modifications to className/structure.
2. Populate ALL placeholders with REAL, SPECIFIC data from the context (names, counts, times, quotes).
3. Ensure RESPONSIVE DESIGN: Use Tailwind classes like w-full, overflow-x-auto, grid-cols-1 md:grid-cols-2, px-3 sm:px-6 for mobile/tablet.
4. Semantic HTML: Proper <h1-6>, <table>/<thead>/<tbody>, <ul>/<li>, <div> for grids.
5. Visual Appeal: Emojis in headers, color-coded cards (e.g., bg-blue-50 for sections), rounded-lg/shadow-sm.
6. Tables: Always wrap in <div className="overflow-x-auto">; min-w-[500px] for wide content; responsive padding.
7. Actionable & Concise: Bullet insights, numbered steps; limit to 800-1200 words.
8. NO Markdown, JSON, or explanations outside HTML.

RESPONSE FORMAT: Pure, valid HTML matching the ${templateType} structure exactly. Begin with <div className="..."> and end with </div>.`;
  }
}

// UPGRADED SYSTEM PROMPT
const ENHANCED_SYSTEM_PROMPT = `You are a precision-engineered Conversation AI Analyst. Craft responses as interactive, responsive HTML dashboards using ONLY the exact structure in the user prompt.

MANDATORY RULES:
- **Structure Fidelity**: Mirror the provided HTML EXACTLY - no additions/deletions to elements/classes.
- **Data-Driven**: Extract & insert REAL metrics/quotes/names from context; fabricate NOTHING.
- **Responsive Excellence**: Embed Tailwind responsive utils (e.g., sm:, md:, overflow-x-auto, grid responsive) for flawless mobile/desktop rendering.
- **Visual Hierarchy**: Use gradients, cards (bg-*-50), icons/emojis, subtle shadows/borders for scannability.
- **Conciseness + Depth**: Balance brevity (under 1500 words) with insights; prioritize tables/charts for data.
- **Error-Free HTML**: Valid, semantic code; tables accessible (scope="col"); no broken tags.

Output: IMMEDIATE HTML ONLY - no prefixes/suffixes. Transform raw analysis into elegant, actionable UIs.`;

// StreamChunk interface
interface StreamChunk {
  type: "start" | "delta" | "end" | "error";
  id?: string;
  timestamp?: string;
  content?: string;
  fullContent?: string;
  error?: string;
  model?: string;
  persisted?: boolean;
}

// RETRY UTILITY WITH EXPONENTIAL BACKOFF
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) throw lastError;
      const delay = baseDelay * Math.pow(2, attempt) * (Math.random() * 0.5 + 0.5);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}

function countTokens(text: string): number {
  return estimateTokens(text);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, model = "gpt-3.5-turbo", maxTokens = 1500, temperature = 0.2 } = SummarizeSchema.parse(body);

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
    }

    // 🛡️ TOKEN ESTIMATION & OPTIMIZED TRUNCATION
    let finalPrompt = prompt;
    const promptTokens = countTokens(prompt);
    const modelLimits = { "gpt-3.5-turbo": 4096, "gpt-4o-mini": 128000 };
    const maxInputTokens = modelLimits[model as keyof typeof modelLimits] - maxTokens - 200; // Added buffer
    
    if (promptTokens > maxInputTokens) {
      // Smart truncation: preserve recent context and important markers
      const lines = prompt.split("\n");
      const recentLines = lines.slice(-Math.floor(lines.length * 0.6)); // Keep 60% most recent
      const importantMarkers = lines.filter(line => 
        line.includes("user:") || line.includes("assistant:") || line.includes("system:")
      );
      
      finalPrompt = [
        ...importantMarkers.slice(-10), // Last 10 important messages
        ...recentLines
      ].join("\n") + "\n[Note: Context optimized for recent and relevant content]";
      
      console.warn(`[API] Prompt optimized: ${promptTokens} -> ${countTokens(finalPrompt)} tokens`);
    }

    // 🚀 REFINE PROMPT
    const refinedPrompt = PromptRefiner.refinePrompt(finalPrompt);
    const refinedTokens = countTokens(refinedPrompt);
    const dynamicMaxTokens = Math.min(
      maxTokens, 
      modelLimits[model as keyof typeof modelLimits] - refinedTokens - 100
    );

    // 📊 ENHANCED STRUCTURED LOGGING
    const queryType = PromptRefiner.analyzeQueryType(PromptRefiner.extractUserQuery(finalPrompt));
    console.log(JSON.stringify({
      level: "info",
      event: "prompt_processing",
      roomId,
      model,
      queryType,
      originalTokens: promptTokens,
      refinedTokens,
      outputTokens: dynamicMaxTokens,
      truncationApplied: promptTokens > maxInputTokens,
      timestamp: new Date().toISOString()
    }));

    // 🎯 OPTIMIZED STREAM GENERATION WITH RETRY
    const completion = await callWithRetry(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: ENHANCED_SYSTEM_PROMPT },
          { role: "user", content: refinedPrompt },
        ],
        max_tokens: dynamicMaxTokens,
        temperature: Math.min(temperature, 0.8), // Cap temperature for consistency
        stream: true,
      })
    );

    // 🔄 HIGH-PERFORMANCE SSE STREAM
    const responseId = uuidv4();
    const timestamp = new Date().toISOString();
    let fullResponse = "";
    let buffer = "";

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          // Init event with enhanced metadata
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: "start", 
                id: responseId, 
                timestamp, 
                model,
                queryType 
              })}\n\n`
            )
          );

          // Stream chunks with buffering for performance
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;
              buffer += content;
              
              // Send chunks in batches for better performance
              if (buffer.length >= 50 || content.includes('\n')) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ type: "delta", content: buffer })}\n\n`
                  )
                );
                buffer = "";
              }
            }
          }

          // Send any remaining buffer
          if (buffer) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "delta", content: buffer })}\n\n`
              )
            );
          }

          // 🗄️ OPTIMIZED DATABASE INSERTION
          const fallbackHtml = `<div class="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-100">
  <div class="text-center">
    <div class="text-4xl mb-4">🤖</div>
    <h2 class="text-2xl font-bold text-gray-800 mb-2">Analysis Complete</h2>
    <p class="text-gray-600">Your conversation has been processed and insights are ready.</p>
  </div>
</div>`;

          const finalContent = fullResponse.trim() || fallbackHtml;
          const estimatedOutputTokens = countTokens(finalContent);

          // Async DB insert - don't block the stream
          const dbPromise = supabase.from("messages").insert({
            id: responseId,
            room_id: roomId,
            sender: "ai-assistant",
            text: finalContent,
            created_at: timestamp,
            metadata: { 
              model, 
              queryType,
              input_tokens: refinedTokens, 
              output_tokens: estimatedOutputTokens,
              processing_time: new Date().toISOString()
            },
          }).then(({ error }) => {
            if (error) {
              console.error("[API] DB Insert Error:", error);
              return false;
            }
            return true;
          });

          const persisted = await dbPromise;

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: "end", 
                id: responseId, 
                fullContent: finalContent, 
                persisted,
                metrics: {
                  inputTokens: refinedTokens,
                  outputTokens: estimatedOutputTokens,
                  queryType
                }
              })}\n\n`
            )
          );
          controller.close();
        } catch (streamErr) {
          console.error("[API] Stream Error:", streamErr);
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: "error", 
                error: "Stream processing interrupted",
                details: (streamErr as Error).message 
              })}\n\n`
            )
          );
          controller.close(); // Use close instead of error for graceful handling
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control, Content-Type",
        "X-Accel-Buffering": "no", // Disable proxy buffering for real-time streams
      },
    });

  } catch (error) {
    console.error("[API] Unhandled Error:", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid input", 
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "AI service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
        suggestion: "Please try again in a few moments"
      },
      { status: 503 }
    );
  }
}