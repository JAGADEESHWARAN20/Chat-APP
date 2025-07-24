"use client";

import React, { useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Imessage, useMessage } from "@/lib/store/messages";

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
  const sendTypingFalse = async () => {
    if (!roomId || !userId) return;
    await supabase
      .from("typing_status")
      .update({ is_typing: false, updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  };

  // Whenever inputValue changes, trigger typing true or false
  useEffect(() => {
    if (inputValue.length > 0) {
      sendTypingTrue();
    } else {
      sendTypingFalse();
    }
  }, [inputValue, sendTypingTrue]);

  // On component unmount, clear typing status
  useEffect(() => {
    return () => {
      sendTypingFalse();
    };
  }, []);

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

  return (
    <div className="p-1 flex items-center">
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
        className="flex-grow rounded px-3 py-2 bg-gray-700 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {inputValue.length > 0 && (
        <Send
          className="ml-2 cursor-pointer text-indigo-400 hover:text-indigo-300"
          size={24}
          onClick={() => {
            handleSendMessage(inputValue);
          }}
        />
      )}
    </div>
  );
}
