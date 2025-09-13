import { useEffect, useState, useMemo } from 'react';
import { useDirectChatStore } from '@/lib/store/directChatStore';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useUser } from '@/lib/store/user';
import Message from '@/components/Message';
import ChatInput from '@/components/ChatInput';
import { useTypingStatus } from '@/hooks/useTypingStatus';
import { toast } from 'sonner';
import type { Imessage } from '@/lib/store/messages';

interface DirectMessageProps {
  chatId: string;
  otherUserId: string;
}

export default function DirectChat({ chatId, otherUserId }: DirectMessageProps) {
  // use the store message type expected by Message component
  const [messages, setMessages] = useState<Imessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { typingUsers, startTyping } = useTypingStatus(chatId, 'direct');

  // use correct field from TypingPresence (hook exports user_id)
  const isTyping = typingUsers.some(u => u.user_id === otherUserId);
  
  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            profiles:sender_id (
              id,
              username,
              avatar_url
            )
          `)
          .eq('direct_chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // Cast incoming data to the store's Imessage shape.
        // Ensure room_id is null for direct messages to match Imessage.DirectMessage typing.
        const msgs = (data ?? []).reverse().map((m: any) => {
          const casted: Imessage = {
            ...m,
            // enforce direct message shape expected by store types
            room_id: null,
            direct_chat_id: m.direct_chat_id ?? null,
            dm_thread_id: m.dm_thread_id ?? null,
            profiles: m.profiles ?? null,
          } as Imessage;
          return casted;
        });

        setMessages(msgs);
        
        // Mark messages as read (only for messages from the other user)
        if ((data ?? []).length > 0 && user?.id) {
          const toUpsert = (data as any[])
            .filter((msg: any) => msg.sender_id !== user.id)
            .map((msg: any) => ({
              message_id: msg.id,
              user_id: user.id,
              read_at: new Date().toISOString()
            }));
          if (toUpsert.length > 0) {
            await supabase.from('message_read_status').upsert(toUpsert);
          }
        }
      } catch (error) {
        toast.error('Error loading messages');
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [chatId, user?.id, supabase]);

  // Subscribe to new messages and read-status updates
  useEffect(() => {
  const channel = supabase.channel(`direct_chat:${chatId}`);

    // New messages
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `direct_chat_id=eq.${chatId}`,
      },
      async (payload: any) => {
        const newMessage = payload.new as any;

        // Fetch sender details
        const { data: sender } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', newMessage.sender_id)
          .single();

        const messageWithProfile: Imessage = {
          ...newMessage,
          room_id: null,
          direct_chat_id: newMessage.direct_chat_id ?? null,
          dm_thread_id: newMessage.dm_thread_id ?? null,
          profiles: sender ?? null,
        } as Imessage;

        setMessages(prev => [...prev, messageWithProfile]);

        // Mark message as read if from other user
        if (newMessage.sender_id !== user?.id && user?.id) {
          await supabase.from('message_read_status').upsert({
            message_id: newMessage.id,
            user_id: user.id,
            read_at: new Date().toISOString()
          });
        }
      }
    );

    // Read status updates: subscribe to all inserts and filter client-side
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_read_status',
      },
      (payload: any) => {
        const readStatus = payload.new as any;
        // Only react when the other user has marked a message read
        if (readStatus.user_id === otherUserId) {
          setMessages(prev =>
            prev.map(m =>
              m.id === readStatus.message_id
                ? ({ ...m, read_at: readStatus.read_at })
                : m
            )
          );
        }
      }
    );

    channel.subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch (e) {
        // ignore unsubscribe errors
      }
    };
  }, [chatId, otherUserId, user?.id, supabase]);

  // Subscribe to typing status broadcast channel
  useEffect(() => {
  const typingChannel = supabase.channel(`typing:${chatId}`);
    
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload.user_id === otherUserId) {
          startTyping();
        }
      })
      .subscribe();

    return () => {
      try {
        typingChannel.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, [chatId, otherUserId, startTyping, supabase]);

  // Send message (kept local but ChatInput in this project expects only `user` prop,
  // so we do not pass onMessageSend prop to ChatInput to match its type)
  const handleSend = async (text: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          direct_chat_id: chatId,
          sender_id: user?.id,
          text,
        })
        .select()
        .single();

      if (error) throw error;

      const inserted = data as any;
      const messageWithProfile: Imessage = {
        ...inserted,
        room_id: null,
        direct_chat_id: inserted.direct_chat_id ?? chatId,
        dm_thread_id: inserted.dm_thread_id ?? null,
        profiles: { id: user?.id, username: user?.username ?? null, avatar_url: user?.avatar_url ?? null }
      } as Imessage;

      // optimistic UI update
      setMessages(prev => [...prev, messageWithProfile]);
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Error:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {messages.map((message) => (
          <Message
            key={(message as any).id}
            message={message}
          />
        ))}
      </div>
      
      {isTyping && (
        <div className="px-4 py-2 text-sm text-gray-500">
          User is typing...
        </div>
      )}

      {/* ChatInput component in this project expects only `user` prop; do not pass unknown props */}
      <ChatInput user={user} />
    </div>
  );
}