"use client";

import React from "react";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "@/lib/store/user";
import { Imessage, useMessage } from "@/lib/store/messages";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";

export default function ChatInput() {
  const user = useUser((state) => state.user);
  const addMessage = useMessage((state) => state.addMessage);
  const replaceMessage = useMessage((state) => state.replaceMessage); // Added
  const setOptimisticIds = useMessage((state) => state.setOptimisticIds);
  const optimisticDeleteMessage = useMessage((state) => state.optimisticDeleteMessage);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user) {
      toast.error("Please log in and enter a message");
      return;
    }
    if (!selectedRoom && !selectedDirectChat) {
      toast.error("Please select a room or user to chat with");
      return;
    }

    const id = uuidv4();
    const roomId = selectedRoom?.id;
    const directChatId = selectedDirectChat?.id;

    const newMessage: Imessage = {
      id,
      text,
      sender_id: user.id,
      room_id: roomId || null,
      direct_chat_id: directChatId || null,
      is_edited: false,
      dm_thread_id: null,
      created_at: new Date().toISOString(),
      status: "sent",
      users: {
        id: user.id,
        avatar_url: user.user_metadata.avatar_url || "",
        created_at: new Date().toISOString(),
        display_name: user.user_metadata.user_name || "",
        username: user.user_metadata.user_name || "",
      },
    };

    // Optimistic update
    addMessage(newMessage);
    setOptimisticIds(id);

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          roomId: roomId || undefined,
          directChatId: directChatId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Replace the optimistic message with the server-returned message
      replaceMessage(id, data.message);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(
        error instanceof Error
          ? `Failed to send message: ${error.message}`
          : "Failed to send message due to an unknown error"
      );
      optimisticDeleteMessage(id);
    }
  };

  return (
    <div className="p-5">
      <Input
        placeholder={
          selectedRoom
            ? `Message #${selectedRoom.name}`
            : selectedDirectChat
            ? "Send direct message"
            : "Select a room or user to start chatting"
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value.trim()) {
            handleSendMessage(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
        disabled={!selectedRoom && !selectedDirectChat}
      />
    </div>
  );
}
