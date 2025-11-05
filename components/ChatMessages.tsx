"use client";

import { Suspense } from "react";
import ListMessages from "./ListMessages";

export default function ChatMessages() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">
      Loading messages...
    </div>}>
      <ListMessages />
    </Suspense>
  );
}


// "use client";
// import { Suspense, useEffect, useCallback } from "react";
// import ListMessages from "./ListMessages";
// import { useRoomContext } from "@/lib/store/RoomContext";
// import { useDirectChatStore } from "@/lib/store/directChatStore";
// import { useMessage } from "@/lib/store/messages";
// import { toast } from "sonner";
// // import { Imessage } from "@/lib/store/messages";

// export default function ChatMessages() {
//   const { selectedRoomId } = useRoomContext();
//   const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);

//   const { setMessages, clearMessages, subscribeToRoom, unsubscribeFromRoom } = useMessage((state) => ({
//     setMessages: state.setMessages,
//     clearMessages: state.clearMessages,
//     subscribeToRoom: state.subscribeToRoom,
//     unsubscribeFromRoom: state.unsubscribeFromRoom,
//   }));

//   const fetchMessages = useCallback(async () => {
//     try {
//       clearMessages();

//       if (selectedRoomId) {
//         const response = await fetch(`/api/messages/${selectedRoomId}`);
//         if (!response.ok) throw new Error("Failed to fetch messages");

//         const { messages } = await response.json();
//         const formatted = Array.isArray(messages)
//           ? messages.map((msg: any) => ({
//               ...msg,
//             }))
//           : [];

//         setMessages(formatted.reverse());
//         subscribeToRoom(selectedRoomId);

//       } else if (selectedDirectChat) {
//         const response = await fetch(`/api/direct-messages/${selectedDirectChat.id}`);
//         if (!response.ok) throw new Error("Failed to fetch direct messages");

//         const { messages } = await response.json();
//         const formatted = Array.isArray(messages)
//           ? messages.map((msg: any) => ({
//               ...msg,
//             }))
//           : [];

//         setMessages(formatted.reverse());
//       }

//     } catch (err) {
//       console.error("Error fetching messages:", err);
//       toast.error("Failed to load messages");
//     }
//   }, [selectedRoomId, selectedDirectChat, setMessages, clearMessages, subscribeToRoom]);

//   useEffect(() => {
//     fetchMessages();
//     return () => {
//       unsubscribeFromRoom();
//     };
//   }, [selectedRoomId, selectedDirectChat, unsubscribeFromRoom, fetchMessages]);

//   return (
//     <Suspense fallback={<div>Loading messages...</div>}>
//       <ListMessages />
//     </Suspense>
//   );
// }
