// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { supabaseBrowser } from "@/lib/supabase/browser";
// import { useUser } from "@/lib/store/user";
// import Message from "@/components/Message";
// import { useTypingStatus } from "@/hooks/useTypingStatus";
// import { toast } from "sonner";
// import type { Imessage } from "@/lib/store/messages";
// import { useRef } from "react";
// import debounce from "lodash.debounce";

// interface DirectMessageProps {
//   chatId: string;
//   otherUserId: string;
// }

// export default function DirectChat({ chatId, otherUserId }: DirectMessageProps) {
//   const [messages, setMessages] = useState<Imessage[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const { user } = useUser();
//   const supabase = useMemo(() => supabaseBrowser(), []);
  
//   // Fixed: useTypingStatus now only accepts roomId (chatId in this case)
//   const { typingUsers, startTyping, stopTyping } = useTypingStatus(
//     chatId,
//     user?.id ?? null
//   );
  
 
//   // Fetch initial messages
//   useEffect(() => {
//     const fetchMessages = async () => {
//       if (!user) return;

//       try {
//         const { data, error } = await supabase
//           .from("messages")
//           .select(
//             `
//             *,
//             profiles:profiles!messages_sender_id_fkey (
//               id,
//               username,
//               avatar_url,
//               display_name
//             )
//           `
//           )
//           .eq("direct_chat_id", chatId)
//           .order("created_at", { ascending: false })
//           .limit(50);

//         if (error) throw error;

//         const messagesWithProfiles = (data || []).map((msg: any) => ({
//           ...msg,
//         }) as Imessage);

//         setMessages(messagesWithProfiles.reverse());

//         // Mark messages as read
//         const unreadMessages = (data || []).filter(
//           (msg: any) => msg.sender_id !== user.id
//         );
//         if (unreadMessages.length > 0) {
//           await supabase.rpc("batch_mark_messages_read", {
//             p_message_ids: unreadMessages.map((m: any) => m.id),
//             p_user_id: user.id,
//           });
//         }
//       } catch (error) {
//         toast.error("Error loading messages");
//         console.error("Error:", error);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchMessages();
//   }, [chatId, user, supabase]);

//   // Subscribe to new messages and read status
//   useEffect(() => {
//     if (!user) return;

//     const channel = supabase.channel(`direct_chat:${chatId}`);

//     channel
//       .on(
//         "postgres_changes",
//         {
//           event: "INSERT",
//           schema: "public",
//           table: "messages",
//           filter: `direct_chat_id=eq.${chatId}`,
//         },
//         async (payload) => {
//           const newMessage = payload.new as any;

//           const { data: sender } = await supabase
//             .from("profiles")
//             .select("id, username, avatar_url, display_name")
//             .eq("id", newMessage.sender_id)
//             .single();

//           const msgWithProfile = { ...newMessage, profiles: sender } as Imessage;

//           setMessages((prev) => [...prev, msgWithProfile]);

//           // Mark message as read if from other user
//           if (newMessage.sender_id !== user.id) {
//             await supabase.rpc("batch_mark_messages_read", {
//               p_message_ids: [newMessage.id],
//               p_user_id: user.id,
//             });
//           }
//         }
//       )
//       .subscribe();

//     return () => {
//       channel.unsubscribe();
//     };
//   }, [chatId, user, supabase, otherUserId]);

//   const handleSend = async (text: string) => {
//     if (!user) return;

//     try {
//       const { data, error } = await supabase
//         .from("messages")
//         .insert({
//           direct_chat_id: chatId,
//           sender_id: user.id,
//           text,
//         })
//         .select(
//           `
//           *,
//           profiles:profiles!messages_sender_id_fkey (
//             id,
//             username,
//             avatar_url,
//             display_name
//           )
//         `
//         )
//         .single();

//       if (error) throw error;

//       setMessages((prev) => [...prev, data as Imessage]);
//     } catch (error) {
//       toast.error("Failed to send message");
//       console.error("Error:", error);
//     }
//   };

//   // Custom ChatInput for direct messages
//   const DirectChatInput = () => {
//     const [text, setText] = useState("");

//     const debouncedStop = useRef(debounce(() => stopTyping(), 2000)).current;
//     useEffect(() => {
//       return () => {
//         debouncedStop.cancel();
//       };
//     }, [debouncedStop]);
    
//     const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//       const newText = e.target.value;
//       setText(newText);
    
//       if (newText.trim().length > 0) {
//         startTyping();
//         debouncedStop();
//       }
//     };

//     const handleSendMessage = () => {
//       if (text.trim()) {
//         handleSend(text.trim());
//         setText("");
//       }
//     };

//     const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
//       if (e.key === "Enter" && !e.shiftKey) {
//         e.preventDefault();
//         handleSendMessage();
//       }
//     };

//     return (
//       <div className="flex gap-2 p-4 border-t bg-background/95">
//         <input
//           value={text}
//           onChange={handleInputChange}
//           onKeyDown={handleKeyDown}
//           placeholder="Type a message..."
//           className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//         />
//         <button
//           onClick={handleSendMessage}
//           disabled={!text.trim()}
//           className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
//         >
//           Send
//         </button>
//       </div>
//     );
//   };

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center h-full text-gray-500">
//         Loading messages...
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-col h-full">
//       {/* Messages Area */}
//       <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
//         {messages.length > 0 ? (
//           messages.map((message) => (
//             <Message key={message.id} message={message} />
//           ))
//         ) : (
//           <div className="flex items-center justify-center h-full text-gray-500">
//             No messages yet. Start a conversation!
//           </div>
//         )}
//       </div>

//       {typingUsers.length > 0 && (
//   <div className="px-4 py-2 text-sm text-gray-500 italic">
//     {typingUsers
//       .filter(u => u.user_id === otherUserId)
//       .map(u => u.user_id) // replace with username if you store it
//       .join(", ") + " is typing..."}
//   </div>
// )}


//       {/* Chat Input */}
//       <DirectChatInput />
//     </div>
//   );
// }