// File: lib/hooks/useMessagePagination.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Imessage } from '@/lib/store/messages';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

interface UseMessagePaginationProps {
  roomId?: string;
  directChatId?: string;
  enabled?: boolean;
}

export function useMessagePagination({
  roomId,
  directChatId,
  enabled = true
}: UseMessagePaginationProps) {
  const [messages, setMessages] = useState<Imessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastMessageRef = useRef<string | null>(null);
  const messagesCache = useRef<Map<string, Imessage>>(new Map());
  const supabase = supabaseBrowser();

  // Function to fetch messages with cursor-based pagination
  const fetchMessages = useCallback(async (cursor?: string) => {
    if (!enabled || (!roomId && !directChatId)) return;

    try {
      setIsLoading(true);

      let query = supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id (
            id,
            username,
            avatar_url,
            display_name
          ),
          read_status:message_read_status(*)
        `)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (roomId) {
        query = query.eq('room_id', roomId);
      } else if (directChatId) {
        query = query.eq('direct_chat_id', directChatId);
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;

      if (error) throw error;

      // cast incoming rows to the store's Imessage type
      const newMessages = (data ?? []).map((msg: any) => ({
        ...msg,
        profiles: msg.profiles ?? null,
      })) as Imessage[];

      // Update cache
      newMessages.forEach((msg) => messagesCache.current.set((msg as any).id, msg));

      setMessages(prev => {
        const combined = [...prev, ...newMessages];
        return combined.sort((a, b) => 
          new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime()
        );
      });

      setHasMore(newMessages.length === PAGE_SIZE);
      
      if (newMessages.length > 0) {
        lastMessageRef.current = (newMessages[newMessages.length - 1] as any).created_at;
      }
    } catch (error) {
      toast.error('Error loading messages');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, directChatId, enabled, supabase]);

  // Initial load
  useEffect(() => {
    setMessages([]);
    lastMessageRef.current = null;
    messagesCache.current.clear();
    fetchMessages();
  }, [fetchMessages]);

  // Function to load more messages
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && lastMessageRef.current) {
      fetchMessages(lastMessageRef.current);
    }
  }, [fetchMessages, isLoading, hasMore]);

  // Function to add a new message
  const addMessage = useCallback((message: Imessage) => {
    messagesCache.current.set(message.id, message);
    setMessages((prev) => {
      const newMessages = [message, ...prev];
      return newMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
  }, []);

  // Function to update a message
  const updateMessage = useCallback((messageId: string, updates: Partial<Imessage>) => {
    const cached = messagesCache.current.get(messageId);
    if (cached) {
      const updated = { ...cached, ...updates };
      messagesCache.current.set(messageId, updated);
      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? updated : msg)
      );
    }
  }, []);

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    addMessage,
    updateMessage
  };
}