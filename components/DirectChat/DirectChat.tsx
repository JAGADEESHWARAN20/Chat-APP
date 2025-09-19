// "use client";

// import { useEffect, useState, useMemo } from 'react';
// import { useDirectChatStore } from '@/lib/store/directChatStore';
// import { supabaseBrowser } from '@/lib/supabase/browser';
// import { useUser } from '@/lib/store/user';
// import Message from '@/components/Message';
// import ChatInput from '@/components/ChatInput';
// import { useTypingStatus } from '@/hooks/useTypingStatus';
// import { toast } from 'sonner';

// interface DirectMessageProps {
//   chatId: string;
//   otherUserId: string;
// }

// export default function DirectChat({ chatId, otherUserId }: DirectMessageProps) {
//   const [messages, setMessages] = useState<any[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const { user } = useUser();
//   const supabase = useMemo(() => supabaseBrowser(), []);
//   const { typingUsers, startTyping } = useTypingStatus(chatId, 'direct');
//   const isTyping = typingUsers.some(u => u.user_id === otherUserId);

//   // Fetch initial messages
//   useEffect(() => {
//     const fetchMessages = async () => {
//       try {
//         const { data, error } = await supabase
//           .from('messages')
//           .select(`
//             *,
//             profiles:profiles!messages_sender_id_fkey (
//               id,
//               username,
//               avatar_url
//             )
//           `)
//           .eq('direct_chat_id', chatId)
//           .order('created_at', { ascending: false })
//           .limit(50);

//         if (error) throw error;
//         setMessages(data.reverse());

//         // Mark messages as read
//         const messagesFromOthers = data.filter(msg => msg.sender_id !== user?.id);
//         if (messagesFromOthers.length > 0) {
//           try {
//             await Promise.all(
//               messagesFromOthers.map(msg =>
//                 supabase.rpc('mark_message_read' as any, {
//                   p_message_id: msg.id,
//                   p_user_id: user?.id
//                 })
//               )
//             );
//           } catch (error) {
//             console.error('Error marking messages as read:', error);
//           }
//         }
//       } catch (error) {
//         toast.error('Error loading messages');
//         console.error('Error:', error);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     if (user) {
//       fetchMessages();
//     }
//   }, [chatId, user, supabase]);

//   // Subscribe to new messages and read status
//   useEffect(() => {
//     if (!user) return;

//     const subscription = supabase
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
//           const newMessage = payload.new;

//           // Enrich via FK select to keep shape consistent
//           const { data: enriched, error: enrichError } = await supabase
//             .from('messages')
//             .select(`
//               *,
//               profiles:profiles!messages_sender_id_fkey (
//                 id,
//                 username,
//                 avatar_url
//               )
//             `)
//             .eq('id', newMessage.id)
//             .single();

//           setMessages(prev => [...prev, enriched || newMessage]);

//           // Mark message as read if from other user
//           if (newMessage.sender_id !== user?.id) {
//             try {
//               await supabase.rpc('mark_message_read' as any, {
//                 p_message_id: newMessage.id,
//                 p_user_id: user.id
//               });
//             } catch (error) {
//               console.error('Error marking message as read:', error);
//             }
//           }
//         }
//       )
//       .subscribe();

//     return () => {
//       subscription.unsubscribe();
//     };
//   }, [chatId, user, supabase]);

//   // Subscribe to typing status
//   useEffect(() => {
//     if (!user) return;

//     const channel = supabase.channel(`typing:${chatId}`);

//     channel
//       .on('broadcast', { event: 'typing' }, ({ payload }) => {
//         if (payload.userId === otherUserId) {
//           startTyping();
//         }
//       })
//       .subscribe();

//     return () => {
//       channel.unsubscribe();
//     };
//   }, [chatId, otherUserId, startTyping, supabase, user]);

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
//         .select()
//         .single();

//       if (error) throw error;
//       // Do not append here; rely on realtime INSERT to add enriched message with profiles
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