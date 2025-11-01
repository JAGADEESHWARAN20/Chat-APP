// types/ai-chat.ts
export interface AIChatHistory {
    id: string;
    room_id: string;
    user_id: string;
    user_query: string;
    ai_response: string;
    model_used: string;
    token_count: number | null;
    message_count: number;
    created_at: string;
    updated_at: string;
  }
  
  export interface CreateAIChatHistory {
    room_id: string;
    user_id: string;
    user_query: string;
    ai_response: string;
    model_used?: string;
    token_count?: number;
    message_count: number;
  }