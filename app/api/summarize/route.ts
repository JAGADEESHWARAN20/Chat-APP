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
  ]).optional().default("gpt-4o-mini"),
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

// AUTO-MODEL SELECTION ALGORITHM
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

  if (promptTokens < 1000 && ['CONVERSATION_SUMMARY', 'GUIDANCE'].includes(analysisType)) {
    return lightweightModels[0];
  }
  
  if (promptTokens < 3000 || analysisType === 'COMPREHENSIVE_ANALYSIS') {
    return balancedModels[Math.floor(Math.random() * balancedModels.length)];
  }
  
  if (promptTokens >= 3000 || ['USER_ANALYSIS', 'SENTIMENT_ANALYSIS', 'TOPIC_ANALYSIS', 'ACTION_ITEMS'].includes(analysisType)) {
    return heavyModels[Math.floor(Math.random() * heavyModels.length)];
  }
  
  return "gpt-4o-mini";
}

// Model context window limits
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

// STRUCTURED RESPONSE TEMPLATES
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

   static extractUserQuery(fullPrompt: string): string {
    const lines = fullPrompt.split("\n");
    const userLines = lines.filter((line) => line.startsWith("user:"));
    return userLines.length > 0
      ? userLines[userLines.length - 1].replace("user:", "").trim()
      : fullPrompt.trim();
  }

   static determineAnalysisType(query: string): string {
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

// SYSTEM PROMPT FOR STRUCTURED RESPONSES
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

// Response interfaces
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

// RETRY UTILITY
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

// Helper to convert structured data to readable format
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { prompt, roomId, model = "gpt-4o-mini", maxTokens = 1500, temperature = 0.2 } = SummarizeSchema.parse(body);

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
    }

    // Token optimization
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

    // AUTO-MODEL SELECTION
    const userQuery = StructuredResponseBuilder.extractUserQuery(finalPrompt);
    const analysisType = StructuredResponseBuilder.determineAnalysisType(userQuery);
    if (!body.model) {
      model = autoSelectModel(promptTokens, analysisType) as any;
      console.log(`[API] Auto-selected model: ${model} for ${analysisType} (tokens: ${promptTokens})`);
    }

    // Create enhanced prompt
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
      model,
      analysisType,
      timestamp: new Date().toISOString()
    }));

    // API call with retry
    const completion = await callWithRetry(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
          { role: "user", content: enhancedPrompt },
        ],
        max_tokens: dynamicMaxTokens,
        temperature: Math.min(temperature, 0.7),
        stream: false,
      })
    );

    const responseId = uuidv4();
    const timestamp = new Date().toISOString();

    // Parse and validate the structured response
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

    // Store in database - FIXED VERSION
    const estimatedOutputTokens = countTokens(content);

    try {
      const { data, error } = await supabase
        .from("ai_chat_history")
        .insert({
          id: responseId,
          room_id: roomId,
          user_query: userQuery,
          ai_response: content,
          model_used: model,
          token_count: estimatedOutputTokens,
          message_count: countTokens(finalPrompt),
          created_at: timestamp,
          analysis_type: analysisType,
          structured_data: structuredData
        })
        .select()
        .single();

      if (error) {
        console.error("[API] DB Insert Error:", error);
        // Return with persisted: false but still return the response
        return NextResponse.json({
          id: responseId,
          timestamp,
          model,
          analysisType,
          fullContent: renderStructuredResponse(structuredData),
          structuredData,
          persisted: false,
          metrics: {
            inputTokens: refinedTokens,
            outputTokens: estimatedOutputTokens,
          }
        });
      }

      // Successfully saved to database
      return NextResponse.json({
        id: responseId,
        timestamp,
        model,
        analysisType,
        fullContent: renderStructuredResponse(structuredData),
        structuredData,
        persisted: true,
        metrics: {
          inputTokens: refinedTokens,
          outputTokens: estimatedOutputTokens,
        }
      });

    } catch (dbError) {
      console.error("[API] Database Error:", dbError);
      // Return response even if DB fails
      return NextResponse.json({
        id: responseId,
        timestamp,
        model,
        analysisType,
        fullContent: renderStructuredResponse(structuredData),
        structuredData,
        persisted: false,
        metrics: {
          inputTokens: refinedTokens,
          outputTokens: estimatedOutputTokens,
        }
      });
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