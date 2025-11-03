// lib/supabase/ai-chat-service.ts
import { getSupabaseBrowserClient } from "./client";
import { Database } from "@/lib/types/supabase";

type AIChatHistory = Database["public"]["Tables"]["ai_chat_history"]["Row"];
type CreateAIChatHistory = Database["public"]["Tables"]["ai_chat_history"]["Insert"];

export class AIChatService {
  private static client = getSupabaseBrowserClient();
  private static channels: Record<string, ReturnType<typeof this.client.channel>> = {};

  private static getClient() {
    return this.client;
  }

  /** Create new AI chat entry */
  static async createChatEntry(entry: CreateAIChatHistory): Promise<AIChatHistory | null> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("ai_chat_history")
      .insert([entry])
      .select()
      .single();

    if (error) {
      console.error("Error creating AI chat entry:", error);
      return null;
    }

    return data as AIChatHistory;
  }

  /** Get AI chat history for a room */
  static async getRoomChatHistory(roomId: string, limit = 50): Promise<AIChatHistory[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("ai_chat_history")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching AI chat history:", error);
      return [];
    }

    return (data as AIChatHistory[]) || [];
  }

  /** Get AI chat history for a user */
  static async getUserChatHistory(userId: string, limit = 50): Promise<AIChatHistory[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from("ai_chat_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching user AI chat history:", error);
      return [];
    }

    return (data as AIChatHistory[]) || [];
  }

  /** Delete AI chat entry by ID */
  static async deleteChatEntry(entryId: string): Promise<boolean> {
    const supabase = this.getClient();
    const { error } = await supabase.from("ai_chat_history").delete().eq("id", entryId);

    if (error) {
      console.error("Error deleting AI chat entry:", error);
      return false;
    }

    return true;
  }

  /** Clear chat history for a specific room */
  static async clearRoomChatHistory(roomId: string): Promise<boolean> {
    const supabase = this.getClient();
    const { error } = await supabase.from("ai_chat_history").delete().eq("room_id", roomId);

    if (error) {
      console.error("Error clearing room AI chat history:", error);
      return false;
    }

    return true;
  }

  /** Subscribe to real-time chat updates (preventing duplicate channels) */
  static subscribeToRoomChatHistory(roomId: string, callback: (payload: any) => void) {
    if (this.channels[roomId]) return this.channels[roomId]; // reuse existing channel

    const channel = this.client
      .channel(`ai-chat-history-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_chat_history",
          filter: `room_id=eq.${roomId}`,
        },
        callback
      )
      .subscribe();

    this.channels[roomId] = channel;
    return channel;
  }

  /** Unsubscribe from real-time updates */
  static unsubscribe(roomId: string) {
    const channel = this.channels[roomId];
    if (!channel) return;

    this.client.removeChannel(channel);
    delete this.channels[roomId];
  }
}
