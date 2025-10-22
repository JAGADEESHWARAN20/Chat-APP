import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpenAI } from "openai";

// Schema for validation
const SummarizeSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(10000, "Prompt too long"),
  model: z.string().optional().default("gpt-3.5-turbo"),
});

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
});

// 🚀 ADVANCED PROMPT REFINEMENT SYSTEM
class PromptRefiner {
  static refinePrompt(rawPrompt: string): string {
    // Extract the actual user query from the context
    const userQuery = this.extractUserQuery(rawPrompt);
    
    // Analyze query type and apply appropriate refinement
    const refinedQuery = this.analyzeAndRefine(userQuery);
    
    // Build enhanced context with structured instructions
    return this.buildEnhancedPrompt(rawPrompt, refinedQuery);
  }

  private static extractUserQuery(fullPrompt: string): string {
    // Extract the most recent user query from conversation history
    const lines = fullPrompt.split('\n');
    const userLines = lines.filter(line => line.startsWith('user:'));
    return userLines.length > 0 ? userLines[userLines.length - 1].replace('user:', '').trim() : fullPrompt;
  }

  private static analyzeAndRefine(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // 🎯 Query Type Detection & Enhancement
    if (lowerQuery.includes('who') && (lowerQuery.includes('message') || lowerQuery.includes('contribute'))) {
      return this.refineUserAnalysisQuery(query);
    } else if (lowerQuery.includes('summary') || lowerQuery.includes('summarize')) {
      return this.refineSummaryQuery(query);
    } else if (lowerQuery.includes('sentiment') || lowerQuery.includes('feel') || lowerQuery.includes('mood')) {
      return this.refineSentimentQuery(query);
    } else if (lowerQuery.includes('topic') || lowerQuery.includes('discuss')) {
      return this.refineTopicQuery(query);
    } else if (lowerQuery.includes('action') || lowerQuery.includes('task') || lowerQuery.includes('todo')) {
      return this.refineActionQuery(query);
    } else if (lowerQuery.includes('when') || lowerQuery.includes('time') || lowerQuery.includes('date')) {
      return this.refineTemporalQuery(query);
    } else {
      return this.refineGeneralQuery(query);
    }
  }

  private static refineUserAnalysisQuery(query: string): string {
    return `Provide a comprehensive analysis of user participation and contribution patterns. Include:
    
    REQUIRED FORMAT:
    ## 👥 User Activity Analysis
    
    ### 📊 Top Contributors
    | Rank | User | Messages | Contribution % | Key Topics |
    |------|------|----------|----------------|------------|
    {table_data_here}
    
    ### 🏆 Most Active User
    **Name**: [User]
    **Messages**: [Count]
    **Peak Activity**: [Time period]
    **Signature Phrases**: [List 2-3 common phrases]
    
    ### 📈 Activity Patterns
    - **Busiest Time**: [Time range]
    - **Engagement Trends**: [Description]
    - **Discussion Leaders**: [List users who drive conversations]
    
    ### 💡 Insights
    - Primary discussion drivers
    - Lurker to active user ratio
    - Community health metrics`;
  }

  private static refineSummaryQuery(query: string): string {
    return `Create a structured, multi-faceted summary with the following sections:
    
    ## 📋 Executive Summary
    [2-3 sentence high-level overview]
    
    ## 🎯 Key Discussion Points
    ### Primary Topics
    • [Topic 1 with emoji] - [Brief description]
    • [Topic 2 with emoji] - [Brief description]
    
    ### Decisions Made
    ✅ [Decision 1]
    ✅ [Decision 2]
    
    ## 📊 Statistical Overview
    | Metric | Value | Trend |
    |--------|-------|-------|
    | Total Messages | [Count] | [📈/📉] |
    | Active Users | [Count] | [📈/📉] |
    | Avg. Message Length | [Words] | [📈/📉] |
    
    ## 🚀 Action Items & Next Steps
    - [ ] [Action with assignee and deadline]
    - [ ] [Action with assignee and deadline]`;
  }

  private static refineSentimentQuery(query: string): string {
    return `Perform detailed sentiment and emotional analysis:
    
    ## 😊 Sentiment Analysis
    
    ### Overall Mood
    **Score**: [Positive/Negative/Neutral] ([0-100]%)
    **Dominant Emotion**: [Primary emotion detected]
    
    ### 📊 Sentiment Breakdown
    | User | Sentiment | Key Emotional Words | Engagement Level |
    |------|-----------|---------------------|------------------|
    | {user1} | {sentiment} | {words} | {level} |
    
    ### 🎭 Emotional Journey
    [Timeline visualization of emotional shifts]
    
    ### 💬 Tone Analysis
    - **Formality Level**: [Casual/Professional/etc.]
    - **Communication Style**: [Collaborative/Argumentative/etc.]
    - **Group Dynamics**: [Description of interpersonal relationships]`;
  }

  private static refineTopicQuery(query: string): string {
    return `Extract and categorize all discussion topics with hierarchical structure:
    
    ## 🗂️ Topic Analysis
    
    ### 🔥 Main Topics (by volume)
    1. **[Topic Name]** ([message_count] messages)
       - **Key Contributors**: [List]
       - **Subtopics**: 
         • [Subtopic 1]
         • [Subtopic 2]
       - **Sentiment**: [Overall feeling]
    
    ### 📈 Topic Evolution
    [How topics emerged and developed over time]
    
    ### 🔗 Topic Relationships
    [How different topics connect and influence each other]
    
    ### 🎯 Unresolved Topics
    - [Topic that needs follow-up]
    - [Questions that remain unanswered]`;
  }

  private static refineActionQuery(query: string): string {
    return `Extract all action items, tasks, and decisions with clear ownership:
    
    ## ✅ Action Items & Decisions
    
    ### 🎯 Confirmed Actions
    | Action | Owner | Deadline | Status | Priority |
    |--------|-------|----------|--------|----------|
    | {action} | @{user} | {date} | {status} | {priority} |
    
    ### 🤝 Decisions Made
    • **[Decision]**: [Description] - [Date decided]
    
    ### 📋 Pending Items
    - [ ] [Item needing resolution]
    
    ### 🔄 Follow-ups Required
    - [Person] needs to follow up on [topic] by [date]`;
  }

  private static refineTemporalQuery(query: string): string {
    return `Create a chronological analysis with timeline:
    
    ## ⏰ Temporal Analysis
    
    ### 📅 Timeline of Key Events
    Use mermaid timeline format to visualize key events chronologically:
    \`\`\`mermaid
    timeline
        title Conversation Timeline
        [Time] : [Event/Key Message]
        [Time] : [Event/Key Message]
    \`\`\`
    
    ### 🕒 Activity Heatmap
    **Peak Hours**: [Time range]
    **Quiet Periods**: [Time range]
    
    ### 🔄 Conversation Flow
    [Phase 1]: [Description]
    → [Phase 2]: [Description]
    → [Phase 3]: [Description]`;
  }

  private static refineGeneralQuery(query: string): string {
    return `Provide a comprehensive, structured analysis of the conversation. Include:
    
    ## 🎯 Quick Answer
    [Direct answer to the specific query]
    
    ## 📊 Supporting Data
    - **Relevant Statistics**: [Data supporting answer]
    - **Key Messages**: [Quotes or message counts]
    - **User Involvement**: [Who was involved]
    
    ## 🔍 Deep Analysis
    [Detailed exploration of the topic]
    
    ## 💡 Recommendations
    - [Actionable insight 1]
    - [Actionable insight 2]
    
    ## 📈 Visual Summary
    [When appropriate, suggest chart types or data visualization approaches]`;
  }

  private static buildEnhancedPrompt(originalContext: string, refinedInstruction: string): string {
    return `CONTEXT: Recent room messages and conversation history:
${originalContext}

ANALYSIS REQUEST: ${refinedInstruction}

IMPORTANT INSTRUCTIONS:
- ALWAYS use structured formats (tables, lists, sections)
- Include relevant emojis for visual scanning
- Provide both high-level insights and detailed data
- Use markdown formatting for better readability
- Include specific numbers, percentages, and metrics when possible
- Highlight patterns, trends, and anomalies
- Suggest actionable next steps

RESPONSE FORMAT: Combine visual appeal with information density. Use headers, tables, and clear section breaks.`;
  }
}

// Enhanced system prompt for the AI
const ENHANCED_SYSTEM_PROMPT = `You are an expert conversation analyst with exceptional data visualization and structuring capabilities. Your responses must be:

🎯 **Highly Structured**: Use clear sections with emojis
📊 **Data-Rich**: Include specific numbers and metrics
📈 **Visual-Friendly**: Suggest chart types and use table formatting
💡 **Actionable**: Provide clear insights and next steps
🎨 **Engaging**: Balance professionalism with readability

Always respond in markdown with appropriate formatting.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model = "gpt-3.5-turbo" } = SummarizeSchema.parse(body);

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
    }

    // 🚀 REFINE THE PROMPT BEFORE SENDING TO AI
    const refinedPrompt = PromptRefiner.refinePrompt(prompt);

    console.log("Refined Prompt:", refinedPrompt); // For debugging

    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: ENHANCED_SYSTEM_PROMPT },
        { role: "user", content: refinedPrompt },
      ],
      max_tokens: 1500, // Increased for richer responses
      temperature: 0.3,
      stream: true,
    });

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            controller.enqueue(new TextEncoder().encode(content));
          }
          controller.close();
        } catch (streamErr) {
          console.error("Stream error:", streamErr);
          controller.error(streamErr);
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });

  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: validationError.issues },
        { status: 400 }
      );
    }
    
    console.error("API Error:", validationError);
    return NextResponse.json(
      { error: "AI service unavailable", code: (validationError as any).status || 503 },
      { status: 503 }
    );
  }
}