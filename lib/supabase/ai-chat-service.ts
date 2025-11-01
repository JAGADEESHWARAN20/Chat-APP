// lib/supabase/ai-chat-service.ts
import { getSupabaseBrowserClient } from './client'; // Fixed import path
import { Database } from '@/lib/types/supabase';

type AIChatHistory = Database['public']['Tables']['ai_chat_history']['Row'];
type CreateAIChatHistory = Database['public']['Tables']['ai_chat_history']['Insert'];


export class AIChatService {
  private static getClient() {
    return getSupabaseBrowserClient();
  }

  // Create new AI chat entry
  static async createChatEntry(entry: CreateAIChatHistory): Promise<AIChatHistory | null> {
    const supabase = this.getClient();
    
    const { data, error } = await supabase
      .from('ai_chat_history')
      .insert([entry])
      .select()
      .single();

    if (error) {
      console.error('Error creating AI chat entry:', error);
      return null;
    }

    // FIXED: Type assertion to ensure proper typing
    return data as AIChatHistory;
  }

  // Get AI chat history for a room
  static async getRoomChatHistory(roomId: string, limit = 50): Promise<AIChatHistory[]> {
    const supabase = this.getClient();
    
    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching AI chat history:', error);
      return [];
    }

    // FIXED: Type assertion to ensure proper typing
    return (data as AIChatHistory[]) || [];
  }

  // Get user's AI chat history
  static async getUserChatHistory(userId: string, limit = 50): Promise<AIChatHistory[]> {
    const supabase = this.getClient();
    
    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user AI chat history:', error);
      return [];
    }

    // FIXED: Type assertion to ensure proper typing
    return (data as AIChatHistory[]) || [];
  }

  // Delete AI chat entry
  static async deleteChatEntry(entryId: string): Promise<boolean> {
    const supabase = this.getClient();
    
    const { error } = await supabase
      .from('ai_chat_history')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting AI chat entry:', error);
      return false;
    }

    return true;
  }

  // Clear all AI chat history for a room
  static async clearRoomChatHistory(roomId: string): Promise<boolean> {
    const supabase = this.getClient();
    
    const { error } = await supabase
      .from('ai_chat_history')
      .delete()
      .eq('room_id', roomId);

    if (error) {
      console.error('Error clearing room AI chat history:', error);
      return false;
    }

    return true;
  }

  // Subscribe to real-time updates for a room
  static subscribeToRoomChatHistory(
    roomId: string, 
    callback: (payload: any) => void
  ) {
    const supabase = this.getClient();
    
    return supabase
      .channel('ai-chat-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_chat_history',
          filter: `room_id=eq.${roomId}`
        },
        callback
      )
      .subscribe();
  }

  // Unsubscribe from real-time updates
  static unsubscribe(channel: any) {
    const supabase = this.getClient();
    supabase.removeChannel(channel);
  }
}