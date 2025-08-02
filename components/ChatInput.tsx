"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Imessage, useMessage } from "@/lib/store/messages";
import { Button } from "./ui/button";

export default function ChatInput() {
  const supabase = supabaseBrowser();
  const user = useUser((state) => state.user);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);

  const roomId = selectedRoom?.id || selectedDirectChat?.id || null;
  const userId = user?.id || null;

  const addMessage = useMessage((state) => state.addMessage);
  const setOptimisticIds = useMessage((state) => state.setOptimisticIds);

  const [inputValue, setInputValue] = useState("");

  // Debounced function to mark user as typing
  const sendTypingTrue = useRef(
    debounce(async () => {
      if (!roomId || !userId) return;
      await supabase.from("typing_status").upsert({
        room_id: roomId,
        user_id: userId,
        is_typing: true,
        updated_at: new Date().toISOString(),
      });
    }, 300)
  ).current;

  // Function to mark user as stopped typing
  const sendTypingFalse = useCallback(async () => {
  if (!roomId || !userId) return;
  await supabase
    .from("typing_status")
    .update({ is_typing: false, updated_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}, [roomId, userId, supabase]);


  // Whenever inputValue changes, trigger typing true or false
useEffect(() => {
  if (inputValue.length > 0) {
    sendTypingTrue();
  } else {
    sendTypingFalse();
  }
}, [inputValue, sendTypingTrue, sendTypingFalse]);


useEffect(() => {
  return () => {
    sendTypingFalse();
  };
}, [sendTypingFalse]);


  // Your existing handleSendMessage: send message and reset typing
  async function handleSendMessage(text: string) {
    if (!text.trim() || !user) {
      toast.error("Please log in and enter a message");
      return;
    }
    if (!selectedRoom && !selectedDirectChat) {
      toast.error("Please select a room or user to chat with");
      return;
    }

    const id = uuidv4();
    const roomIdValue = selectedRoom?.id;
    const directChatIdValue = selectedDirectChat?.id;

    const newMessage: Imessage = {
      id,
      text,
      sender_id: user.id,
      room_id: roomIdValue || null,
      direct_chat_id: directChatIdValue || null,
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
      const { error } = await supabase
        .from("messages")
        .insert({
          id,
          text,
          room_id: roomIdValue,
          direct_chat_id: directChatIdValue,
          sender_id: user.id,
          created_at: new Date().toISOString(),
          status: "sent",
        });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Failed to send message: ${error.message}`);
      } else {
        toast.error("Failed to send message due to an unknown error");
      }
      // Rollback optimistic message
      useMessage.getState().optimisticDeleteMessage(id);
      return;
    }

    setInputValue(""); // Clear input after sending

    // Notify typing stopped after message sent
    await sendTypingFalse();
  }

  const handleSend = () => {
    if (inputValue.trim()) {
      handleSendMessage(inputValue);
    }
  };

  return (
    <div className="p-4 border-t bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={
            selectedRoom
              ? `Message #${selectedRoom.name}`
              : selectedDirectChat
              ? "Send direct message"
              : "Select a room or user to start chatting"
          }
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              handleSendMessage(e.currentTarget.value);
            }
          }}
          disabled={!selectedRoom && !selectedDirectChat}
          className="
            flex-grow rounded-lg px-3 py-2
            bg-background
            text-foreground
            placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-ring
            transition-colors
            dark:bg-gray-700
            dark:text-foreground
            dark:placeholder:text-muted-foreground
            border border-gray-300 dark:border-gray-600
          "
        />
        <Button
          onClick={handleSend}
          disabled={!inputValue.trim() || (!selectedRoom && !selectedDirectChat)}
          size="icon"
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
