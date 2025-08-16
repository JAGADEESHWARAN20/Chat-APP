"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Imessage, useMessage } from "@/lib/store/messages";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function ChatInput() {
  const supabase = supabaseBrowser();
  const user = useUser((state) => state.user);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);

  const addMessage = useMessage((state) => state.addMessage);
  const setOptimisticIds = useMessage((state) => state.setOptimisticIds);

  const [inputValue, setInputValue] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const roomId = selectedRoom?.id || selectedDirectChat?.id || "";
  const userId = user?.id || "";

  const { typingUsers, setIsTyping } = useTypingStatus(roomId, userId);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setInputValue(value);

  // User is typing - set status to true
  setIsTyping(true);

  // Clear any existing timeout
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }

  // Set timeout to mark as not typing after 1 second of inactivity
  typingTimeoutRef.current = setTimeout(() => {
    setIsTyping(false);
  }, 1000);
};

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsTyping(false); // Ensure we mark as not typing when leaving
    };
  }, [setIsTyping]);

  async function handleSendMessage(text: string) {
    if (!text.trim() || !user) {
      toast.error("Please log in and enter a message");
      return;
    }
    if (!roomId) {
      toast.error("Please select a room or user to chat with");
      return;
    }

    // Immediately stop typing and clear the input
    setIsTyping(false);
    setInputValue("");
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const id = uuidv4();
    const newMessage: Imessage = {
      id,
      text,
      sender_id: user.id,
      room_id: selectedRoom?.id || null,
      direct_chat_id: selectedDirectChat?.id || null,
      is_edited: false,
      dm_thread_id: null,
      created_at: new Date().toISOString(),
      status: "sent",
      users: {
        id: user.id,
        avatar_url: user.user_metadata.avatar_url || "",
        created_at: user.created_at || new Date().toISOString(),
        display_name: user.user_metadata.user_name || "Anonymous",
        username: user.user_metadata.user_name || "anonymous",
      },
    };

    // Optimistic update
    addMessage(newMessage);
    setOptimisticIds(id);

    try {
      const { error } = await supabase
        .from("messages")
        .insert({
          id,
          text,
          room_id: selectedRoom?.id,
          direct_chat_id: selectedDirectChat?.id,
          sender_id: user.id,
          status: "sent",
        });

      if (error) throw error;
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Failed to send message: ${error.message}`);
      }
      useMessage.getState().optimisticDeleteMessage(id); // Rollback
    }
  }

  return (
    <div className="p-1 flex flex-col">
      {typingUsers.length > 0 && (
        <div className="text-sm text-gray-500 px-2">
          {typingUsers.length === 1
            ? "Someone is typing..."
            : `${typingUsers.length} people are typing...`}
        </div>
      )}
      <div className="flex items-center">
        <input
          type="text"
          placeholder={
            roomId
              ? `Message ${selectedRoom ? "#" + selectedRoom.name : "..."}`
              : "Select a chat to begin"
          }
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && inputValue.trim()) {
              e.preventDefault();
              handleSendMessage(inputValue);
            }
          }}
          disabled={!roomId}
          className="
            flex-grow rounded px-3 py-2
            bg-background
            text-foreground
            placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-ring
            transition-colors
          "
        />
        {inputValue.length > 0 && (
          <Send
            className="ml-2 cursor-pointer text-primary hover:text-primary/90 transition-colors"
            size={24}
            onClick={() => handleSendMessage(inputValue)}
          />
        )}
      </div>
    </div>
  );
}