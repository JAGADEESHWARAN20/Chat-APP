// "use client";

// import { useEffect, useState, useMemo } from 'react';
// import { supabaseBrowser } from '@/lib/supabase/browser';
// import { useUser } from '@/lib/store/user';
// import Message from '@/components/Message';
// import ChatInput from '@/components/ChatInput';
// import { useTypingStatus } from '@/hooks/useTypingStatus';
// import { toast } from 'sonner';
// import type { Imessage } from '@/lib/store/messages';

// interface DirectMessageProps {
//   chatId: string;
//   otherUserId: string;
// }

// export default function DirectChat({ chatId, otherUserId }: DirectMessageProps) {
//   const [messages, setMessages] = useState<Imessage[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const { user } = useUser();
//   const supabase = useMemo(() => supabaseBrowser(), []);
//   const { typingUsers } = useTypingStatus(chatId, 'direct');
//   const isTyping = typingUsers.some(u => u.user_id === otherUserId);
  
//   // Fetch initial messages
//   useEffect(() => {
//     const fetchMessages = async () => {
//       if (!user) return;

//       try {
//         const { data, error } = await supabase
//           .from('messages')
//           .select(
//             `
//             *,
//             profiles:profiles!messages_sender_id_fkey (
//               id,
//               username,
//               avatar_url,
//               display_name
//             ),
//             read_status:message_read_status (
//               id, message_id, user_id, read_at
//             )
//           `
//           )
//           .eq('direct_chat_id', chatId)
//           .order('created_at', { ascending: false })
//           .limit(50);

//         if (error) throw error;

//         const messagesWithProfiles = (data || []).map((msg: any) => msg as Imessage);

//         setMessages(messagesWithProfiles.reverse());
        
//         // Mark messages as read
//         const unreadMessages = (data || []).filter((msg: any) => msg.sender_id !== user.id && !(msg.read_status && msg.read_status[0] && msg.read_status[0].read_at));

//         if (unreadMessages.length > 0) {
//           const { error: readError } = await supabase.rpc('batch_mark_messages_read', {
//             p_message_ids: unreadMessages.map((m: any) => m.id),
//             p_user_id: user.id
//           });

//           if (readError) {
//             console.error('Error marking messages as read:', readError);
//           }
//         }
//       } catch (error) {
//         toast.error('Error loading messages');
//         console.error('Error:', error);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchMessages();
//   }, [chatId, user, supabase]);

//   // Subscribe to new messages and read status
//   useEffect(() => {
//     if (!user) return;

//     const messageSubscription = supabase
//       .channel(`direct_chat:${chatId}`)
//       .on(
//         'postgres_changes',
//         {
//           event: 'INSERT',
//           schema: 'public',
//           table: 'messages',
//           filter: `direct_chat_id=eq.${chatId}`,
//         },
//         async (payload) => {
//           const newMessage = payload.new as any;

//           // Fetch sender details if not included
//           const { data: sender } = await supabase
//             .from('profiles')
//             .select('id, username, avatar_url, display_name')
//             .eq('id', newMessage.sender_id)
//             .single();

//           const msgWithProfile = { ...newMessage, profiles: sender } as Imessage;

//           setMessages(prev => [...prev, msgWithProfile]);

//           // Mark message as read if from other user
//           if (newMessage.sender_id !== user.id) {
//             const { error: readError } = await supabase.rpc('batch_mark_messages_read', {
//               p_message_ids: [newMessage.id],
//               p_user_id: user.id
//             });

//             if (readError) {
//               console.error('Error marking message as read:', readError);
//             }
//           }
//         }
//       )
//       .subscribe();

//     // Subscribe to read status updates
//     const readStatusSubscription = supabase
//       .channel(`read_status:${chatId}`)
//       .on(
//         'postgres_changes',
//         {
//           event: 'INSERT',
//           schema: 'public',
//           table: 'message_read_status',
//           filter: `user_id=eq.${otherUserId}`,
//         },
//         (payload) => {
//           const readStatus = payload.new;
//           setMessages(prev => 
//             prev.map(msg => 
//               msg.id === readStatus.message_id 
//                 ? { ...msg, read_at: readStatus.read_at }
//                 : msg
//             )
//           );
//         }
//       )
//       .subscribe();

//     return () => {
//       messageSubscription.unsubscribe();
//       readStatusSubscription.unsubscribe();
//     };
//   }, [chatId, user, supabase, otherUserId]);

//   const handleSend = async (text: string) => {
//     if (!user) return;

//     try {
//       const { data, error } = await supabase
//         .from('messages')
//         .insert({
//           direct_chat_id: chatId,
//           sender_id: user.id,
//           text,
//         })
//         .select(`
//           *,
//           profiles:profiles!messages_sender_id_fkey (
//             id,
//             username,
//             avatar_url,
//             display_name
//           )
//         `)
//         .single();

//       if (error) throw error;

//       // Optimistically add message to UI
//       setMessages(prev => [...prev, (data as any) as Imessage]);
//     } catch (error) {
//       toast.error('Failed to send message');
//       console.error('Error:', error);
//     }
//   };

//   if (isLoading) {
//     return <div>Loading...</div>;
//   }

//   return (
//     <div className="flex flex-col h-full">
//       <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
//         {messages.map((message) => (
//           <Message
//             key={message.id}
//             message={message}
//           />
//         ))}
//       </div>
      
//       {isTyping && (
//         <div className="px-4 py-2 text-sm text-gray-500">
//           User is typing...
//         </div>
//       )}

//       <ChatInput user={user} />
//     </div>
//   );
// }