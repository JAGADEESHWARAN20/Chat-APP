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

// 🚀 ENHANCED PROMPT REFINEMENT SYSTEM WITH HTML STRUCTURE
class PromptRefiner {
  static refinePrompt(rawPrompt: string): string {
    const userQuery = this.extractUserQuery(rawPrompt);
    const queryType = this.analyzeQueryType(userQuery);
    const refinedQuery = this.refineByQueryType(userQuery, queryType);
    return this.buildEnhancedPrompt(rawPrompt, refinedQuery, queryType);
  }

  private static extractUserQuery(fullPrompt: string): string {
    const lines = fullPrompt.split('\n');
    const userLines = lines.filter(line => line.startsWith('user:'));
    return userLines.length > 0 ? userLines[userLines.length - 1].replace('user:', '').trim() : fullPrompt;
  }

  private static analyzeQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('who') && (lowerQuery.includes('message') || lowerQuery.includes('contribute') || lowerQuery.includes('active'))) {
      return 'USER_ANALYSIS';
    } else if (lowerQuery.includes('summary') || lowerQuery.includes('summarize') || lowerQuery.includes('overview')) {
      return 'SUMMARY';
    } else if (lowerQuery.includes('sentiment') || lowerQuery.includes('feel') || lowerQuery.includes('mood') || lowerQuery.includes('emotion')) {
      return 'SENTIMENT';
    } else if (lowerQuery.includes('topic') || lowerQuery.includes('discuss') || lowerQuery.includes('theme')) {
      return 'TOPIC_ANALYSIS';
    } else if (lowerQuery.includes('action') || lowerQuery.includes('task') || lowerQuery.includes('todo') || lowerQuery.includes('decision')) {
      return 'ACTION_ITEMS';
    } else if (lowerQuery.includes('when') || lowerQuery.includes('time') || lowerQuery.includes('date') || lowerQuery.includes('timeline')) {
      return 'TEMPORAL';
    } else if (lowerQuery.includes('help') || lowerQuery.includes('what can') || lowerQuery.includes('capability')) {
      return 'HELP';
    } else {
      return 'GENERAL';
    }
  }

  private static refineByQueryType(query: string, queryType: string): string {
    switch (queryType) {
      case 'USER_ANALYSIS':
        return this.refineUserAnalysisQuery(query);
      case 'SUMMARY':
        return this.refineSummaryQuery(query);
      case 'SENTIMENT':
        return this.refineSentimentQuery(query);
      case 'TOPIC_ANALYSIS':
        return this.refineTopicQuery(query);
      case 'ACTION_ITEMS':
        return this.refineActionQuery(query);
      case 'TEMPORAL':
        return this.refineTemporalQuery(query);
      case 'HELP':
        return this.refineHelpQuery(query);
      default:
        return this.refineGeneralQuery(query);
    }
  }

  private static refineUserAnalysisQuery(query: string): string {
    return `Generate a comprehensive user activity analysis with this EXACT HTML structure:

<div className="analysis-container">
  <div className="header-section">
    <h2>👥 User Activity Analysis</h2>
    <p>Comprehensive breakdown of participant engagement and contribution patterns</p>
  </div>

  <div className="top-contributors">
    <h3>🏆 Top Contributors</h3>
    <table className="contributors-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>User</th>
          <th>Messages</th>
          <th>Contribution %</th>
          <th>Key Topics</th>
        </tr>
      </thead>
      <tbody>
        <!-- Generate 3-5 rows with actual data -->
      </tbody>
    </table>
  </div>

  <div className="activity-highlights">
    <div className="highlight-card">
      <h4>📈 Most Active User</h4>
      <p><strong>Name:</strong> [User Name]</p>
      <p><strong>Messages:</strong> [Count]</p>
      <p><strong>Peak Activity:</strong> [Time Period]</p>
    </div>
    
    <div className="highlight-card">
      <h4>🕒 Activity Patterns</h4>
      <ul>
        <li><strong>Busiest Time:</strong> [Time Range]</li>
        <li><strong>Engagement Trend:</strong> [Description]</li>
        <li><strong>Active Participants:</strong> [Number] users</li>
      </ul>
    </div>
  </div>

  <div className="insights-section">
    <h3>💡 Key Insights</h3>
    <div className="insights-grid">
      <div className="insight-item">
        <span className="insight-icon">🎯</span>
        <p>Primary discussion drivers and their impact</p>
      </div>
      <div className="insight-item">
        <span className="insight-icon">📊</span>
        <p>Participation distribution across users</p>
      </div>
      <div className="insight-item">
        <span className="insight-icon">🤝</span>
        <p>Collaboration patterns and group dynamics</p>
      </div>
    </div>
  </div>
</div>`;
  }

  private static refineSummaryQuery(query: string): string {
    return `Generate a structured conversation summary with this EXACT HTML structure:

<div className="summary-container">
  <div className="executive-summary">
    <h2>📋 Executive Summary</h2>
    <div className="summary-content">
      <p>[2-3 sentence high-level overview capturing main purpose and outcomes]</p>
    </div>
  </div>

  <div className="key-points">
    <h3>🎯 Key Discussion Points</h3>
    <div className="topics-grid">
      <div className="topic-card">
        <span className="topic-emoji">💬</span>
        <div className="topic-content">
          <h4>[Primary Topic 1]</h4>
          <p>[Brief description and significance]</p>
        </div>
      </div>
      <div className="topic-card">
        <span className="topic-emoji">💡</span>
        <div className="topic-content">
          <h4>[Primary Topic 2]</h4>
          <p>[Brief description and significance]</p>
        </div>
      </div>
    </div>
  </div>

  <div className="statistics-section">
    <h3>📊 Conversation Statistics</h3>
    <div className="stats-grid">
      <div className="stat-item">
        <div className="stat-value">[Total Messages]</div>
        <div className="stat-label">Total Messages</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">[Active Users]</div>
        <div className="stat-label">Active Participants</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">[Avg Length]</div>
        <div className="stat-label">Avg Message Length</div>
      </div>
    </div>
  </div>

  <div className="decisions-section">
    <h3>✅ Decisions & Outcomes</h3>
    <ul className="decisions-list">
      <li className="decision-item">
        <span className="decision-icon">✓</span>
        <span>[Key decision made with impact]</span>
      </li>
      <li className="decision-item">
        <span className="decision-icon">✓</span>
        <span>[Important conclusion reached]</span>
      </li>
    </ul>
  </div>
</div>`;
  }

  private static refineSentimentQuery(query: string): string {
    return `Generate a sentiment analysis with this EXACT HTML structure:

<div className="sentiment-container">
  <div className="sentiment-header">
    <h2>😊 Sentiment Analysis</h2>
    <p>Emotional tone and mood assessment of the conversation</p>
  </div>

  <div className="overall-sentiment">
    <h3>🌈 Overall Mood</h3>
    <div className="sentiment-score">
      <div className="score-card positive">
        <span className="score-value">[75%]</span>
        <span className="score-label">Positive</span>
      </div>
      <div className="score-card neutral">
        <span className="score-value">[20%]</span>
        <span className="score-label">Neutral</span>
      </div>
      <div className="score-card negative">
        <span className="score-value">[5%]</span>
        <span className="score-label">Negative</span>
      </div>
    </div>
    <p className="dominant-emotion"><strong>Dominant Emotion:</strong> [Primary emotion detected]</p>
  </div>

  <div className="sentiment-breakdown">
    <h3>📊 User Sentiment Breakdown</h3>
    <table className="sentiment-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Sentiment</th>
          <th>Key Phrases</th>
          <th>Engagement</th>
        </tr>
      </thead>
      <tbody>
        <!-- Generate rows for each significant user -->
      </tbody>
    </table>
  </div>

  <div className="emotional-journey">
    <h3>🎭 Emotional Journey</h3>
    <div className="timeline">
      <div className="timeline-item">
        <div className="timeline-marker"></div>
        <div className="timeline-content">
          <h4>[Phase 1]</h4>
          <p>[Emotional state and key triggers]</p>
        </div>
      </div>
      <div className="timeline-item">
        <div className="timeline-marker"></div>
        <div className="timeline-content">
          <h4>[Phase 2]</h4>
          <p>[Emotional shift and contributing factors]</p>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  private static refineTopicQuery(query: string): string {
    return `Generate a topic analysis with this EXACT HTML structure:

<div className="topics-container">
  <div className="topics-header">
    <h2>🗂️ Topic Analysis</h2>
    <p>Comprehensive breakdown of discussion themes and their evolution</p>
  </div>

  <div className="main-topics">
    <h3>🔥 Main Discussion Topics</h3>
    <div className="topics-list">
      <div className="topic-main">
        <div className="topic-header">
          <span className="topic-rank">1</span>
          <h4>[Primary Topic Name]</h4>
          <span className="message-count">([Message Count] messages)</span>
        </div>
        <div className="topic-details">
          <p><strong>Key Contributors:</strong> [List of main contributors]</p>
          <div className="subtopics">
            <h5>Related Subtopics:</h5>
            <ul>
              <li>[Subtopic 1]</li>
              <li>[Subtopic 2]</li>
            </ul>
          </div>
          <p className="topic-sentiment"><strong>Overall Sentiment:</strong> [Positive/Negative/Neutral]</p>
        </div>
      </div>
    </div>
  </div>

  <div className="topic-relationships">
    <h3>🔗 Topic Connections</h3>
    <div className="relationships-grid">
      <div className="relationship-item">
        <div className="relationship-topics">
          <span>[Topic A]</span>
          <span className="connector">↔</span>
          <span>[Topic B]</span>
        </div>
        <p>[Description of relationship and influence]</p>
      </div>
    </div>
  </div>

  <div className="unresolved-topics">
    <h3>🎯 Open Questions & Follow-ups</h3>
    <ul className="unresolved-list">
      <li className="unresolved-item">
        <span className="question-icon">❓</span>
        <span>[Topic that needs further discussion]</span>
      </li>
      <li className="unresolved-item">
        <span className="question-icon">❓</span>
        <span>[Question awaiting answer]</span>
      </li>
    </ul>
  </div>
</div>`;
  }

  private static refineActionQuery(query: string): string {
    return `Generate an action items analysis with this EXACT HTML structure:

<div className="actions-container">
  <div className="actions-header">
    <h2>✅ Action Items & Decisions</h2>
    <p>Clear overview of tasks, responsibilities, and outcomes</p>
  </div>

  <div className="confirmed-actions">
    <h3>🎯 Confirmed Action Items</h3>
    <table className="actions-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Owner</th>
          <th>Deadline</th>
          <th>Status</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        <!-- Generate rows for each action item -->
      </tbody>
    </table>
  </div>

  <div className="decisions-made">
    <h3>🤝 Decisions Reached</h3>
    <div className="decisions-list">
      <div className="decision-card">
        <span className="decision-icon">✓</span>
        <div className="decision-content">
          <h4>[Decision Title]</h4>
          <p>[Brief description of decision]</p>
          <span className="decision-date">Decided on: [Date]</span>
        </div>
      </div>
    </div>
  </div>

  <div className="pending-items">
    <h3>📋 Pending Items</h3>
    <ul className="pending-list">
      <li className="pending-item">
        <span className="pending-icon">⏳</span>
        <span>[Item needing resolution or follow-up]</span>
      </li>
    </ul>
  </div>

  <div className="follow-ups">
    <h3>🔄 Required Follow-ups</h3>
    <div className="follow-up-list">
      <div className="follow-up-item">
        <strong>[Person Name]</strong> needs to follow up on <strong>[Topic]</strong> by <strong>[Date]</strong>
      </div>
    </div>
  </div>
</div>`;
  }

  private static refineTemporalQuery(query: string): string {
    return `Generate a temporal analysis with this EXACT HTML structure:

<div className="temporal-container">
  <div className="temporal-header">
    <h2>⏰ Conversation Timeline</h2>
    <p>Chronological analysis of key events and activity patterns</p>
  </div>

  <div className="key-events">
    <h3>📅 Key Events Timeline</h3>
    <div className="timeline-vertical">
      <div className="timeline-event">
        <div className="event-time">[Time]</div>
        <div className="event-content">
          <h4>[Event/Key Message]</h4>
          <p>[Significance and impact]</p>
        </div>
      </div>
      <div className="timeline-event">
        <div className="event-time">[Time]</div>
        <div className="event-content">
          <h4>[Event/Key Message]</h4>
          <p>[Significance and impact]</p>
        </div>
      </div>
    </div>
  </div>

  <div className="activity-patterns">
    <h3>🕒 Activity Patterns</h3>
    <div className="patterns-grid">
      <div className="pattern-card">
        <h4>Peak Hours</h4>
        <p className="pattern-value">[Time Range]</p>
        <p className="pattern-desc">Highest engagement period</p>
      </div>
      <div className="pattern-card">
        <h4>Quiet Periods</h4>
        <p className="pattern-value">[Time Range]</p>
        <p className="pattern-desc">Lowest activity times</p>
      </div>
    </div>
  </div>

  <div className="conversation-flow">
    <h3>🔄 Conversation Flow</h3>
    <div className="flow-steps">
      <div className="flow-step">
        <div className="step-number">1</div>
        <div className="step-content">
          <h4>[Phase 1: Introduction]</h4>
          <p>[Description of phase characteristics]</p>
        </div>
      </div>
      <div className="flow-step">
        <div className="step-number">2</div>
        <div className="step-content">
          <h4>[Phase 2: Discussion]</h4>
          <p>[Description of phase characteristics]</p>
        </div>
      </div>
      <div className="flow-step">
        <div className="step-number">3</div>
        <div className="step-content">
          <h4>[Phase 3: Conclusion]</h4>
          <p>[Description of phase characteristics]</p>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  private static refineHelpQuery(query: string): string {
    return `Generate a help response with this EXACT HTML structure:

<div className="help-container">
  <div className="help-header">
    <h2>🤖 AI Assistant Help</h2>
    <p>Here's what I can help you analyze about your conversation</p>
  </div>

  <div className="capabilities-grid">
    <div className="capability-card">
      <span className="capability-icon">👥</span>
      <h4>User Analysis</h4>
      <p>Ask about who contributed most, active users, participation patterns</p>
      <code>Who was most active? Show user statistics</code>
    </div>

    <div className="capability-card">
      <span className="capability-icon">📋</span>
      <h4>Summary & Overview</h4>
      <p>Get executive summaries and key discussion points</p>
      <code>Summarize the conversation</code>
    </div>

    <div className="capability-card">
      <span className="capability-icon">😊</span>
      <h4>Sentiment Analysis</h4>
      <p>Understand emotional tone and mood patterns</p>
      <code>What's the overall sentiment?</code>
    </div>

    <div className="capability-card">
      <span className="capability-icon">🗂️</span>
      <h4>Topic Analysis</h4>
      <p>Identify main themes and discussion topics</p>
      <code>What topics were discussed?</code>
    </div>

    <div className="capability-card">
      <span className="capability-icon">✅</span>
      <h4>Action Items</h4>
      <p>Extract decisions, tasks, and follow-ups</p>
      <code>Show action items and decisions</code>
    </div>

    <div className="capability-card">
      <span className="capability-icon">⏰</span>
      <h4>Temporal Analysis</h4>
      <p>Analyze timing, patterns, and conversation flow</p>
      <code>When was the busiest time?</code>
    </div>
  </div>

  <div className="examples-section">
    <h3>💡 Example Queries</h3>
    <ul className="examples-list">
      <li>"Who sent the most messages?"</li>
      <li>"Give me a summary of the main points"</li>
      <li>"What was the overall mood of the conversation?"</li>
      <li>"Show me the action items discussed"</li>
      <li>"What topics were covered in detail?"</li>
    </ul>
  </div>
</div>`;
  }

  private static refineGeneralQuery(query: string): string {
    return `Generate a comprehensive analysis with this EXACT HTML structure:

<div className="general-analysis">
  <div className="quick-answer">
    <h2>🎯 Quick Answer</h2>
    <p>[Direct, concise answer to the user's specific query]</p>
  </div>

  <div className="supporting-data">
    <h3>📊 Supporting Evidence</h3>
    <div className="data-grid">
      <div className="data-item">
        <span className="data-label">Relevant Statistics</span>
        <span className="data-value">[Specific numbers and metrics]</span>
      </div>
      <div className="data-item">
        <span className="data-label">Key Messages</span>
        <span className="data-value">[Important quotes or highlights]</span>
      </div>
      <div className="data-item">
        <span className="data-label">User Involvement</span>
        <span className="data-value">[Participants and their roles]</span>
      </div>
    </div>
  </div>

  <div className="deep-analysis">
    <h3>🔍 Detailed Analysis</h3>
    <div className="analysis-content">
      <p>[Comprehensive exploration of the topic with insights and patterns]</p>
    </div>
  </div>

  <div className="recommendations">
    <h3>💡 Recommendations</h3>
    <ul className="recommendations-list">
      <li className="recommendation-item">
        <span className="recommendation-icon">🚀</span>
        <span>[Actionable insight or suggestion]</span>
      </li>
      <li className="recommendation-item">
        <span className="recommendation-icon">💡</span>
        <span>[Strategic recommendation]</span>
      </li>
    </ul>
  </div>
</div>`;
  }

  private static buildEnhancedPrompt(originalContext: string, refinedInstruction: string, queryType: string): string {
    return `CONVERSATION CONTEXT:
${originalContext}

USER REQUEST: ${refinedInstruction}

CRITICAL RESPONSE REQUIREMENTS:
1. USE ONLY the EXACT HTML structure provided above - do not modify className names or structure
2. Fill in all placeholder content with ACTUAL data from the conversation
3. Use proper semantic HTML with meaningful content
4. Include specific numbers, names, and details from the context
5. Make responses visually appealing with emojis and clear hierarchy
6. Ensure all tables have proper header rows and data cells
7. Use consistent formatting throughout
8. Provide actionable insights and concrete data

RESPONSE FORMAT: Pure HTML with the exact structure specified for ${queryType} analysis type.`;
  }
}

// Enhanced system prompt for structured HTML responses
const ENHANCED_SYSTEM_PROMPT = `You are an expert conversation analyst that generates beautifully structured HTML responses. Your responses MUST:

1. Use EXACT HTML structures provided in the user prompt
2. Fill placeholders with real data from the conversation context
3. Create visually appealing, well-organized layouts
4. Include specific metrics, names, and concrete details
5. Use semantic HTML with proper headings, tables, and lists
6. Maintain consistent styling with provided className names
7. Provide actionable insights and clear takeaways
8. Balance comprehensive analysis with readability

Always respond with pure HTML using the exact structure specified in the user's prompt. Do not include any markdown or alternative formatting.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model = "gpt-3.5-turbo" } = SummarizeSchema.parse(body);

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "API configuration missing" }, { status: 500 });
    }

    // 🚀 REFINE THE PROMPT BEFORE SENDING TO AI
    const refinedPrompt = PromptRefiner.refinePrompt(prompt);

    console.log("Refined Prompt:", refinedPrompt);

    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: ENHANCED_SYSTEM_PROMPT },
        { role: "user", content: refinedPrompt },
      ],
      max_tokens: 2000, // Increased for HTML responses
      temperature: 0.2, // Lower temperature for more consistent structure
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
        "Content-Type": "text/html; charset=utf-8", // Changed to HTML
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