import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { estimateTokens } from "@/lib/token-utils";
import type { Database } from "@/lib/types/supabase";

// ---------- Validation ----------
const SummarizeSchema = z.object({
  prompt: z.string().min(1).max(15000),
  roomId: z.string().min(1),
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

// ---------- Token Limits ----------
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

// ---------- Clients ----------
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "FlyCode Chat AI Assistant", // your app name
  },
});


const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- Types ----------
interface StructuredAnalysis {
  type: string;
  title: string;
  summary: string;
  sections: { title: string; content: string; metrics?: string[]; highlights?: string[] }[];
  keyFindings: string[];
  recommendations: string[];
  metadata: { participantCount: number; messageCount: number; timeRange: string; sentiment: string };
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      // stop retrying for unauthorized errors
      if (err?.code === 401 || err?.error?.code === 401) {
        console.error("[OpenRouter Auth Error] API key invalid or missing headers.");
        throw new Error("Unauthorized OpenRouter request");
      }
      if (i === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw new Error("Retry limit exceeded");
}


// ---------- Handler ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, roomId, userId = "system", model, maxTokens, temperature } =
      SummarizeSchema.parse(body);

    console.log("[AI Summarize] Request:", { roomId, userId, model });

    const promptTokens = estimateTokens(prompt);
    const maxInputTokens = modelLimits[model] - maxTokens - 200;

    let finalPrompt = prompt;
    if (promptTokens > maxInputTokens) {
      finalPrompt =
        prompt.split("\n").slice(-Math.floor(prompt.split("\n").length * 0.6)).join("\n") +
        "\n[Context trimmed for token optimization]";
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
      structured_data: JSON.parse(JSON.stringify(structuredData)), // Supabase JSON-safe
      created_at: new Date().toISOString(),
    });

    if (error) console.error("[Supabase Error]", error);

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



// import { NextRequest, NextResponse } from "next/server";
// import { z } from "zod";
// import { OpenAI } from "openai";
// import { createClient } from "@supabase/supabase-js";
// import { v4 as uuidv4 } from "uuid";
// import { estimateTokens } from '@/lib/token-utils';
// import type { Database } from "@/lib/types/supabase";



// // Enhanced Schema
// const SummarizeSchema = z.object({
//   prompt: z.string().min(1, "Prompt cannot be empty").max(15000, "Prompt too long"),
//   roomId: z.string().min(1, "Room ID required for persistence"),
//   userId: z.string().min(1, "User ID required for persistence"),
//   model: z.enum([
//     "gpt-3.5-turbo",
//     "gpt-4o-mini",
//     "minimax/minimax-m2",
//     "andromeda/alpha",
//     "tongyi/deepresearch-30b-a3b",
//     "meituan/longcat-flash-chat",
//     "nvidia/nemotron-nano-9b-v2",
//     "deepseek/deepseek-v3-1",
//     "openai/gpt-oss-20b",
//     "z-ai/glm-4-5-air",
//     "qwen/qwen3-coder-480b-a35b",
//     "moonshot/kimi-k2-0711"
//   ]).optional().default("gpt-4o-mini"),
//   maxTokens: z.number().min(100).max(3000).optional().default(1500),
//   temperature: z.number().min(0).max(1).optional().default(0.2),
// });

// // Initialize clients with SERVICE ROLE KEY
// const openai = new OpenAI({
//   apiKey: process.env.OPENROUTER_API_KEY,
//   baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
// });

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// // USE SERVICE ROLE KEY FOR SERVER-SIDE OPERATIONS
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// if (!supabaseUrl || !supabaseKey) {
//   throw new Error('Supabase environment variables are not configured');
// }

// const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// // Model context window limits
// const modelLimits = {
//   "gpt-3.5-turbo": 4096,
//   "gpt-4o-mini": 128000,
//   "minimax/minimax-m2": 205000,
//   "andromeda/alpha": 128000,
//   "tongyi/deepresearch-30b-a3b": 131000,
//   "meituan/longcat-flash-chat": 131000,
//   "nvidia/nemotron-nano-9b-v2": 128000,
//   "deepseek/deepseek-v3-1": 164000,
//   "openai/gpt-oss-20b": 131000,
//   "z-ai/glm-4-5-air": 131000,
//   "qwen/qwen3-coder-480b-a35b": 262000,
//   "moonshot/kimi-k2-0711": 33000,
// };

// // Structured Response Builder
// class StructuredResponseBuilder {
//   static createAnalysisPrompt(rawPrompt: string, roomContext: string): string {
//     const userQuery = this.extractUserQuery(rawPrompt);
//     const analysisType = this.determineAnalysisType(userQuery);
    
//     return `ROOM CONTEXT & CONVERSATION HISTORY:
// ${roomContext}

// USER QUERY: "${userQuery}"

// ANALYSIS TYPE: ${analysisType}

// RESPONSE REQUIREMENTS:
// 1. Return ONLY valid JSON with this exact structure:
// {
//   "type": "${analysisType}",
//   "title": "Brief descriptive title",
//   "summary": "2-3 sentence overview",
//   "sections": [
//     {
//       "title": "Section Title",
//       "content": "Detailed analysis",
//       "metrics": ["metric1: value"],
//       "highlights": ["key point"]
//     }
//   ],
//   "keyFindings": ["finding1"],
//   "recommendations": ["recommendation1"],
//   "metadata": {
//     "participantCount": number,
//     "messageCount": number,
//     "timeRange": "description",
//     "sentiment": "overall sentiment"
//   }
// }

// 2. Use ONLY data from provided context
// 3. Be specific and actionable
// 4. Return ONLY valid JSON. No additional text.`;
//   }

//   static extractUserQuery(fullPrompt: string): string {
//     const lines = fullPrompt.split("\n");
//     const userLines = lines.filter((line) => line.startsWith("user:"));
//     return userLines.length > 0
//       ? userLines[userLines.length - 1].replace("user:", "").trim()
//       : fullPrompt.trim();
//   }

//   static determineAnalysisType(query: string): string {
//     const lowerQuery = query.toLowerCase();
//     if (/(summary|overview|recap|tl;dr)/i.test(lowerQuery)) return "CONVERSATION_SUMMARY";
//     if (/(user|participant|who|people|engagement)/i.test(lowerQuery)) return "USER_ANALYSIS";
//     if (/(sentiment|mood|emotion|tone|feel)/i.test(lowerQuery)) return "SENTIMENT_ANALYSIS";
//     if (/(topic|theme|discuss|subject|main)/i.test(lowerQuery)) return "TOPIC_ANALYSIS";
//     if (/(action|task|todo|decision|next)/i.test(lowerQuery)) return "ACTION_ITEMS";
//     if (/(help|how|what can|capability)/i.test(lowerQuery)) return "GUIDANCE";
//     return "COMPREHENSIVE_ANALYSIS";
//   }
// }

// // System Prompt
// const STRUCTURED_SYSTEM_PROMPT = `You are an expert conversation analyst. Return ONLY valid JSON with this structure:
// {
//   "type": "analysis_type",
//   "title": "string",
//   "summary": "string", 
//   "sections": [{"title": "string", "content": "string", "metrics": ["string"], "highlights": ["string"]}],
//   "keyFindings": ["string"],
//   "recommendations": ["string"],
//   "metadata": {"participantCount": number, "messageCount": number, "timeRange": "string", "sentiment": "string"}
// }`;

// // Interfaces
// interface StructuredAnalysis {
//   type: string;
//   title: string;
//   summary: string;
//   sections: Array<{
//     title: string;
//     content: string;
//     metrics: string[];
//     highlights: string[];
//   }>;
//   keyFindings: string[];
//   recommendations: string[];
//   metadata: {
//     participantCount: number;
//     messageCount: number;
//     timeRange: string;
//     sentiment: string;
//   };
// }

// // Helper functions
// async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
//   for (let attempt = 0; attempt < maxRetries; attempt++) {
//     try {
//       return await fn();
//     } catch (error) {
//       if (attempt === maxRetries - 1) throw error;
//       await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
//     }
//   }
//   throw new Error("Max retries exceeded");
// }

// function renderStructuredResponse(data: StructuredAnalysis): string {
//   let response = `# ${data.title}\n\n${data.summary}\n\n`;
//   data.sections.forEach(section => {
//     response += `## ${section.title}\n${section.content}\n\n`;
//     if (section.metrics.length > 0) response += `**Metrics:**\n${section.metrics.map(m => `• ${m}\n`).join('')}\n`;
//     if (section.highlights.length > 0) response += `**Highlights:**\n${section.highlights.map(h => `• ${h}\n`).join('')}\n`;
//   });
//   if (data.keyFindings.length > 0) response += `## Key Findings\n${data.keyFindings.map(f => `• ${f}\n`).join('')}\n`;
//   if (data.recommendations.length > 0) response += `## Recommendations\n${data.recommendations.map(r => `• ${r}\n`).join('')}`;
//   return response;
// }

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     let { prompt, roomId, userId, model = "gpt-4o-mini", maxTokens = 1500, temperature = 0.2 } = SummarizeSchema.parse(body);

//     if (!process.env.OPENROUTER_API_KEY) {
//       return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
//     }

//     console.log("[API] Processing request:", { roomId, userId, model, promptLength: prompt.length });

//     // Token optimization
//     let finalPrompt = prompt;
//     const promptTokens = estimateTokens(prompt);
//     const maxInputTokens = modelLimits[model as keyof typeof modelLimits] - maxTokens - 200;
    
//     if (promptTokens > maxInputTokens) {
//       const lines = prompt.split("\n");
//       const recentLines = lines.slice(-Math.floor(lines.length * 0.6));
//       const importantMarkers = lines.filter(line => line.includes("user:") || line.includes("assistant:") || line.includes("Room \""));
//       finalPrompt = [...importantMarkers.slice(-10), ...recentLines].join("\n") + "\n[Context optimized]";
//     }

//     // Auto-model selection
//     const userQuery = StructuredResponseBuilder.extractUserQuery(finalPrompt);
//     const analysisType = StructuredResponseBuilder.determineAnalysisType(userQuery);
//     if (!body.model) {
//       model = "gpt-4o-mini"; // Simplified auto-selection
//     }

//     // Create enhanced prompt
//     const roomContext = finalPrompt.includes("Room \"") 
//       ? finalPrompt.split("Room \"")[1]?.split("Chat History:")[0] || finalPrompt
//       : finalPrompt;

//     const enhancedPrompt = StructuredResponseBuilder.createAnalysisPrompt(finalPrompt, roomContext);
//     const refinedTokens = estimateTokens(enhancedPrompt);
//     const dynamicMaxTokens = Math.min(maxTokens, modelLimits[model as keyof typeof modelLimits] - refinedTokens - 100);

//     // API call
//     const completion = await callWithRetry(() =>
//       openai.chat.completions.create({
//         model,
//         messages: [
//           { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
//           { role: "user", content: enhancedPrompt },
//         ],
//         max_tokens: dynamicMaxTokens,
//         temperature: Math.min(temperature, 0.7),
//         stream: false,
//       })
//     );

//     const responseId = uuidv4();
//     const timestamp = new Date().toISOString();
//     const content = completion.choices[0]?.message?.content?.trim() || '';
    
//     // Parse structured response
//     let structuredData: StructuredAnalysis;
//     try {
//       structuredData = JSON.parse(content);
//       if (!structuredData.type || !structuredData.title || !structuredData.sections) {
//         throw new Error("Invalid response structure");
//       }
//     } catch (parseError) {
//       console.error("Failed to parse structured response:", parseError);
//       structuredData = {
//         type: analysisType,
//         title: "Conversation Analysis",
//         summary: "Analysis based on your query.",
//         sections: [{
//           title: "Key Insights",
//           content: content || "Unable to generate analysis.",
//           metrics: [],
//           highlights: []
//         }],
//         keyFindings: ["Analysis completed"],
//         recommendations: ["Review conversation for insights"],
//         metadata: { participantCount: 0, messageCount: 0, timeRange: "Unknown", sentiment: "Neutral" }
//       };
//     }

//     // Store in database - USING SERVICE ROLE KEY TO BYPASS RLS
//     const estimatedOutputTokens = estimateTokens(content);

//     console.log("[API] Saving to ai_chat_history:", { room_id: roomId, user_id: userId });

//     const { data: dbData, error } = await supabase
//     .from("ai_chat_history")
//     .insert({
//       id: responseId,
//       room_id: roomId,
//       user_id: userId,
//       user_query: userQuery,
//       ai_response: content,
//       model_used: model,
//       token_count: estimatedOutputTokens,
//       message_count: estimateTokens(finalPrompt),
//       created_at: timestamp,
//       analysis_type: analysisType,
//       structured_data: structuredData ? JSON.parse(JSON.stringify(structuredData)) : null, // ✅ FIX HERE
//     })
//     .select()
//     .single();
  

//     if (error) {
//       console.error("[API] DB Insert Error:", error);
//       return NextResponse.json({
//         id: responseId,
//         timestamp,
//         model,
//         analysisType,
//         fullContent: renderStructuredResponse(structuredData),
//         structuredData,
//         persisted: false,
//         metrics: { inputTokens: refinedTokens, outputTokens: estimatedOutputTokens }
//       });
//     }

//     console.log("[API] Successfully saved with ID:", dbData.id);
//     return NextResponse.json({
//       id: responseId,
//       timestamp,
//       model,
//       analysisType,
//       fullContent: renderStructuredResponse(structuredData),
//       structuredData,
//       persisted: true,
//       metrics: { inputTokens: refinedTokens, outputTokens: estimatedOutputTokens }
//     });

//   } catch (error) {
//     console.error("[API] Unhandled Error:", error);
//     if (error instanceof z.ZodError) {
//       return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
//     }
//     return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
//   }
// }