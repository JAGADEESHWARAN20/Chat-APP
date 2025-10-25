import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { estimateTokens } from '@/lib/token-utils';

// Enhanced Schema with expanded model enum
const SummarizeSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(15000, "Prompt too long"),
  roomId: z.string().min(1, "Room ID required for persistence"),
  model: z.enum([
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
    "moonshot/kimi-k2-0711"
  ]).optional().default("gpt-4o-mini"), // Default to efficient model
  maxTokens: z.number().min(100).max(3000).optional().default(1500),
  temperature: z.number().min(0).max(1).optional().default(0.2),
});

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are not configured');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 🎯 AUTO-MODEL SELECTION ALGORITHM
// Selects model based on query complexity (tokens + type) if not provided by client
function autoSelectModel(promptTokens: number, analysisType: string): string {
  const lightweightModels = [
    "gpt-4o-mini",
    "nvidia/nemotron-nano-9b-v2",
    "minimax/minimax-m2",
    "andromeda/alpha"
  ];
  const balancedModels = [
    "openai/gpt-oss-20b",
    "z-ai/glm-4-5-air",
    "meituan/longcat-flash-chat"
  ];
  const heavyModels = [
    "deepseek/deepseek-v3-1",
    "tongyi/deepresearch-30b-a3b",
    "qwen/qwen3-coder-480b-a35b",
    "moonshot/kimi-k2-0711"
  ];

  // Simple: Low tokens + basic types
  if (promptTokens < 1000 && ['CONVERSATION_SUMMARY', 'GUIDANCE'].includes(analysisType)) {
    return lightweightModels[0]; // Fastest lightweight
  }
  
  // Balanced: Medium tokens or standard analysis
  if (promptTokens < 3000 || analysisType === 'COMPREHENSIVE_ANALYSIS') {
    return balancedModels[Math.floor(Math.random() * balancedModels.length)]; // Rotate for load
  }
  
  // Heavy: High tokens + complex types (e.g., coding/agentic)
  if (promptTokens >= 3000 || ['USER_ANALYSIS', 'SENTIMENT_ANALYSIS', 'TOPIC_ANALYSIS', 'ACTION_ITEMS'].includes(analysisType)) {
    return heavyModels[Math.floor(Math.random() * heavyModels.length)]; // Rotate heavy for best fit
  }
  
  return "gpt-4o-mini"; // Fallback
}

// Expanded model limits (context window approximations)
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
};

// 🎯 STRUCTURED RESPONSE TEMPLATES (unchanged)
class StructuredResponseBuilder {
  static createAnalysisPrompt(rawPrompt: string, roomContext: string): string {
    const userQuery = this.extractUserQuery(rawPrompt);
    const analysisType = this.determineAnalysisType(userQuery);
    
    return `ROOM CONTEXT & CONVERSATION HISTORY:
${roomContext}

USER QUERY: "${userQuery}"

ANALYSIS TYPE: ${analysisType}

RESPONSE REQUIREMENTS:

1. **STRUCTURED FORMAT**: Return a JSON object with this exact structure:
{
  "type": "${analysisType}",
  "title": "Brief descriptive title",
  "summary": "2-3 sentence overview of key findings",
  "sections": [
    {
      "title": "Section 1 Title",
      "content": "Detailed analysis content",
      "metrics": ["metric1: value", "metric2: value"],
      "highlights": ["key point 1", "key point 2"]
    }
  ],
  "keyFindings": ["finding1", "finding2", "finding3"],
  "recommendations": ["recommendation1", "recommendation2"],
  "metadata": {
    "participantCount": number,
    "messageCount": number,
    "timeRange": "description",
    "sentiment": "overall sentiment"
  }
}

2. **CONTENT GUIDELINES**:
   - Use ONLY data from the provided conversation context
   - Be specific and actionable
   - Include quantitative metrics when available
   - Focus on practical insights
   - Maintain professional tone

3. **ANALYSIS FOCUS FOR ${analysisType}**:
${this.getAnalysisFocus(analysisType)}

IMPORTANT: Return ONLY valid JSON. No additional text or explanations.`;
  }

  private static extractUserQuery(fullPrompt: string): string {
    const lines = fullPrompt.split("\n");
    const userLines = lines.filter((line) => line.startsWith("user:"));
    return userLines.length > 0
      ? userLines[userLines.length - 1].replace("user:", "").trim()
      : fullPrompt.trim();
  }

  private static determineAnalysisType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (/(summary|overview|recap|tl;dr)/i.test(lowerQuery)) return "CONVERSATION_SUMMARY";
    if (/(user|participant|who|people|engagement)/i.test(lowerQuery)) return "USER_ANALYSIS";
    if (/(sentiment|mood|emotion|tone|feel)/i.test(lowerQuery)) return "SENTIMENT_ANALYSIS";
    if (/(topic|theme|discuss|subject|main)/i.test(lowerQuery)) return "TOPIC_ANALYSIS";
    if (/(action|task|todo|decision|next)/i.test(lowerQuery)) return "ACTION_ITEMS";
    if (/(help|how|what can|capability)/i.test(lowerQuery)) return "GUIDANCE";
    
    return "COMPREHENSIVE_ANALYSIS";
  }

  private static getAnalysisFocus(analysisType: string): string {
    const focusMap = {
      "CONVERSATION_SUMMARY": `- Extract main discussion points and conclusions
- Identify key decisions and outcomes
- Highlight important information exchanges
- Provide chronological overview`,

      "USER_ANALYSIS": `- Analyze participant engagement levels
- Identify most active contributors
- Note participation patterns and roles
- Highlight expertise areas`,

      "SENTIMENT_ANALYSIS": `- Assess overall emotional tone
- Identify sentiment shifts
- Note agreement/disagreement patterns
- Highlight emotional highlights`,

      "TOPIC_ANALYSIS": `- Map main discussion topics
- Identify topic transitions
- Note unanswered questions
- Highlight emerging themes`,

      "ACTION_ITEMS": `- Extract specific tasks
- Identify decisions requiring follow-up
- Note deadlines or time-sensitive items
- Highlight ownership areas`,

      "GUIDANCE": `- Provide clear, step-by-step assistance
- Offer practical advice
- Suggest best practices
- Connect to available features`,

      "COMPREHENSIVE_ANALYSIS": `- Combine key insights from all areas
- Provide holistic conversation view
- Connect patterns across dimensions
- Offer strategic recommendations`
    };

    return focusMap[analysisType as keyof typeof focusMap] || focusMap.COMPREHENSIVE_ANALYSIS;
  }
}

// 🧠 SYSTEM PROMPT FOR STRUCTURED RESPONSES (unchanged)
const STRUCTURED_SYSTEM_PROMPT = `You are an expert conversation analyst. Your role is to provide structured, actionable analysis of conversation data.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON with the exact structure specified in the user prompt
2. Use ONLY information present in the provided context
3. Be specific, quantitative, and actionable
4. Focus on practical insights users can implement

RESPONSE FORMAT:
You must return a JSON object with this structure:
{
  "type": "analysis_type",
  "title": "string",
  "summary": "string", 
  "sections": [
    {
      "title": "string",
      "content": "string",
      "metrics": ["string array"],
      "highlights": ["string array"]
    }
  ],
  "keyFindings": ["string array"],
  "recommendations": ["string array"],
  "metadata": {
    "participantCount": number,
    "messageCount": number,
    "timeRange": "string",
    "sentiment": "string"
  }
}

Do not include any other text or explanations.`;

// Response interfaces (unchanged)
interface AnalysisSection {
  title: string;
  content: string;
  metrics: string[];
  highlights: string[];
}

interface AnalysisMetadata {
  participantCount: number;
  messageCount: number;
  timeRange: string;
  sentiment: string;
}

interface StructuredAnalysis {
  type: string;
  title: string;
  summary: string;
  sections: AnalysisSection[];
  keyFindings: string[];
  recommendations: string[];
  metadata: AnalysisMetadata;
}

// StreamChunk interface (unchanged)
interface StreamChunk {
  type: "start" | "delta" | "end" | "error";
  id?: string;
  timestamp?: string;
  content?: string;
  fullContent?: string;
  structuredData?: StructuredAnalysis;
  error?: string;
  model?: string;
  persisted?: boolean;
}

// RETRY UTILITY (unchanged)
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
    let { prompt, roomId, model = "gpt-4o-mini", maxTokens = 1500, temperature = 0.2 } = SummarizeSchema.parse(body);

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
    }

    // Token optimization (unchanged)
    let finalPrompt = prompt;
    const promptTokens = countTokens(prompt);
    const maxInputTokens = modelLimits[model as keyof typeof modelLimits] - maxTokens - 200;
    
    if (promptTokens > maxInputTokens) {
      const lines = prompt.split("\n");
      const recentLines = lines.slice(-Math.floor(lines.length * 0.6));
      const importantMarkers = lines.filter(line => 
        line.includes("user:") || line.includes("assistant:") || line.includes("Room \"")
      );
      
      finalPrompt = [
        ...importantMarkers.slice(-10),
        ...recentLines
      ].join("\n") + "\n[Context optimized for recent content]";
    }

    // AUTO-MODEL SELECTION: If no model specified, auto-choose based on complexity
    const userQuery = StructuredResponseBuilder['extractUserQuery'](finalPrompt);
    const analysisType = StructuredResponseBuilder['determineAnalysisType'](userQuery);
    if (!body.model) { // Only auto if not explicitly provided by client (respects roomassistant selection)
      model = autoSelectModel(promptTokens, analysisType) as typeof model; // Cast to enum type
      console.log(`[API] Auto-selected model: ${model} for ${analysisType} (tokens: ${promptTokens})`);
    }

    // Create enhanced prompt (unchanged)
    const roomContext = finalPrompt.includes("Room \"") 
      ? finalPrompt.split("Room \"")[1]?.split("Chat History:")[0] || finalPrompt
      : finalPrompt;

    const enhancedPrompt = StructuredResponseBuilder.createAnalysisPrompt(finalPrompt, roomContext);
    const refinedTokens = countTokens(enhancedPrompt);
    const dynamicMaxTokens = Math.min(
      maxTokens, 
      modelLimits[model as keyof typeof modelLimits] - refinedTokens - 100
    );

    // Logging with selected model
    console.log(JSON.stringify({
      level: "info",
      event: "structured_analysis_request",
      roomId,
      model, // Now includes auto-selected
      analysisType,
      timestamp: new Date().toISOString()
    }));

    // API call with retry (unchanged)
    const completion = await callWithRetry(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
          { role: "user", content: enhancedPrompt },
        ],
        max_tokens: dynamicMaxTokens,
        temperature: Math.min(temperature, 0.7),
        stream: false, // Use non-streaming for structured JSON
      })
    );

    const responseId = uuidv4();
    const timestamp = new Date().toISOString();

    try {
      // Parse and validate the structured response (unchanged)
      const content = completion.choices[0]?.message?.content?.trim() || '';
      
      let structuredData: StructuredAnalysis;
      try {
        structuredData = JSON.parse(content);
        
        // Validate basic structure
        if (!structuredData.type || !structuredData.title || !structuredData.sections) {
          throw new Error("Invalid response structure");
        }
      } catch (parseError) {
        console.error("Failed to parse structured response:", parseError);
        // Fallback structured response
        structuredData = {
          type: analysisType,
          title: "Conversation Analysis",
          summary: "Analysis of the conversation based on your query.",
          sections: [{
            title: "Key Insights",
            content: content || "Unable to generate structured analysis. Please try again.",
            metrics: [],
            highlights: []
          }],
          keyFindings: ["Analysis completed"],
          recommendations: ["Review the conversation for more insights"],
          metadata: {
            participantCount: 0,
            messageCount: 0,
            timeRange: "Unknown",
            sentiment: "Neutral"
          }
        };
      }

      // Store in database (updated with model)
      const estimatedOutputTokens = countTokens(content);
      const dbPromise = supabase.from("ai_chat_history").insert({
        id: responseId,
        room_id: roomId,
        user_query: StructuredResponseBuilder['extractUserQuery'](finalPrompt),
        ai_response: content,
        model_used: model, // Ensure selected model is stored
        token_count: estimatedOutputTokens,
        message_count: countTokens(finalPrompt),
        created_at: timestamp,
        analysis_type: analysisType,
        structured_data: structuredData
      }).then(({ error }) => {
        if (error) {
          console.error("[API] DB Insert Error:", error);
          return false;
        }
        return true;
      });

      const persisted = await dbPromise;

      return NextResponse.json({
        id: responseId,
        timestamp,
        model, // Echo back selected model
        analysisType,
        fullContent: renderStructuredResponse(structuredData),
        structuredData,
        persisted,
        metrics: {
          inputTokens: refinedTokens,
          outputTokens: estimatedOutputTokens,
        }
      });

    } catch (processingError) {
      console.error("[API] Response Processing Error:", processingError);
      
      // Return error response
      return NextResponse.json({
        error: "Failed to process analysis response",
        details: (processingError as Error).message
      }, { status: 500 });
    }

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
        error: "Analysis service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
        suggestion: "Please try again in a few moments"
      },
      { status: 503 }
    );
  }
}

// Helper to convert structured data to readable format (unchanged)
function renderStructuredResponse(data: StructuredAnalysis): string {
  let response = `# ${data.title}\n\n`;
  response += `${data.summary}\n\n`;
  
  data.sections.forEach(section => {
    response += `## ${section.title}\n`;
    response += `${section.content}\n\n`;
    
    if (section.metrics.length > 0) {
      response += `**Metrics:**\n`;
      section.metrics.forEach(metric => response += `• ${metric}\n`);
      response += `\n`;
    }
    
    if (section.highlights.length > 0) {
      response += `**Highlights:**\n`;
      section.highlights.forEach(highlight => response += `• ${highlight}\n`);
      response += `\n`;
    }
  });
  
  if (data.keyFindings.length > 0) {
    response += `## Key Findings\n`;
    data.keyFindings.forEach(finding => response += `• ${finding}\n`);
    response += `\n`;
  }
  
  if (data.recommendations.length > 0) {
    response += `## Recommendations\n`;
    data.recommendations.forEach(rec => response += `• ${rec}\n`);
  }
  
  return response;
}