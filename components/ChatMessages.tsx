"use client";

import { Suspense, useEffect, useCallback } from "react";
import ListMessages from "./ListMessages";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useMessage } from "@/lib/store/messages";
import { toast } from "sonner";
import { Imessage } from "@/lib/store/messages";

export default function ChatMessages() {
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
  const { setMessages, clearMessages, subscribeToRoom, unsubscribeFromRoom } = useMessage((state) => ({
    setMessages: state.setMessages,
    clearMessages: state.clearMessages,
    subscribeToRoom: state.subscribeToRoom,
    unsubscribeFromRoom: state.unsubscribeFromRoom,
  }));

  const fetchMessages = useCallback(async () => {
    try {
      // Clear existing messages before fetching new ones
      clearMessages();

      if (selectedRoom) {
        const response = await fetch(`/api/messages/${selectedRoom.id}`);
        if (!response.ok) throw new Error("Failed to fetch messages");
        const { messages } = await response.json();

        const formattedMessages: Imessage[] = (messages && Array.isArray(messages) ? messages.map((msg: any) => ({
          id: msg.id,
          created_at: msg.created_at,
          is_edited: msg.is_edited,
          sender_id: msg.sender_id,
          text: msg.text,
          room_id: msg.room_id,
          direct_chat_id: msg.direct_chat_id,
          dm_thread_id: msg.dm_thread_id,
          status: msg.status,
          users: msg.users || null,
          profiles: msg.profiles || null,
        })) : []) || [];

        setMessages(formattedMessages.reverse());
        
        // Subscribe to real-time updates for the room
        subscribeToRoom(selectedRoom.id);
      } else if (selectedDirectChat) {
        const response = await fetch(`/api/direct-messages/${selectedDirectChat.id}`);
        if (!response.ok) throw new Error("Failed to fetch direct messages");
        const { messages } = await response.json();

        const formattedMessages: Imessage[] = (messages && Array.isArray(messages) ? messages.map((msg: any) => ({
          id: msg.id,
          created_at: msg.created_at,
          is_edited: msg.is_edited,
          sender_id: msg.sender_id,
          text: msg.text,
          room_id: msg.room_id,
          direct_chat_id: msg.direct_chat_id,
          dm_thread_id: msg.dm_thread_id,
          status: msg.status,
          users: msg.users || null,
          profiles: msg.profiles || null,
        })) : []) || [];

        setMessages(formattedMessages.reverse());
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    }
  }, [selectedRoom, selectedDirectChat, setMessages, clearMessages, subscribeToRoom]);

  useEffect(() => {
    fetchMessages();

    // Cleanup subscription when component unmounts or room changes
    return () => {
      unsubscribeFromRoom();
    };
  }, [fetchMessages, unsubscribeFromRoom]);

  return (
    <Suspense fallback={<div>Loading messages...</div>}>
      <ListMessages />
    </Suspense>
  );
}
