// components/ChatInput.tsx - UPDATED PART
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMessage } from "@/lib/store/messages";
import { useRoomContext } from "@/lib/store/RoomContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Imessage } from "@/lib/store/messages";
import { Send } from "lucide-react";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function ChatInput() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addMessage, addOptimisticId } = useMessage();
  const { state } = useRoomContext();
  const { selectedRoom, selectedDirectChat, user } = state;

  // FIXED: Use handleTyping instead of start/stop directly
  const { handleTyping, stopTyping } = useTypingStatus();

  const canSend = Boolean(text.trim()) && !isSending && (selectedRoom || selectedDirectChat) && user;
  const hasActiveChat = Boolean(selectedRoom || selectedDirectChat);

  // FIXED: Use handleTyping for proper debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Trigger typing indicator when text is not empty
    if (newText.trim().length > 0 && hasActiveChat) {
      handleTyping();
    }
  }, [handleTyping, hasActiveChat]);

  // Add onBlur to stop typing
  const handleBlur = useCallback(() => {
    if (hasActiveChat) {
      stopTyping();
    }
  }, [stopTyping, hasActiveChat]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    setIsSending(true);
    stopTyping(); // Stop typing when sending

    const optimisticId = uuidv4();
    const optimisticMessage: Imessage = {
      id: optimisticId,
      text: text.trim(),
      sender_id: user!.id,
      room_id: selectedRoom?.id || null,
      direct_chat_id: selectedDirectChat?.id || null,
      dm_thread_id: null,
      created_at: new Date().toISOString(),
      is_edited: false,
      status: "sending",
      profiles: {
        id: user!.id,
        display_name: user!.user_metadata?.display_name || user!.email || "Anonymous",
        avatar_url: user!.user_metadata?.avatar_url || "",
        username: user!.user_metadata?.username || "",
        created_at: user!.created_at,
        updated_at: null,
        bio: null,
      },
    };

    addOptimisticId(optimisticId);
    addMessage(optimisticMessage);
    setText("");

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom?.id,
          directChatId: selectedDirectChat?.id,
          text: text.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send message");

      addMessage({ ...optimisticMessage, id: result.messageId || optimisticId, status: "sent" });
      toast.success("Message sent");
    } catch (error) {
      console.error("[ChatInput] Send error:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [canSend, text, user, selectedRoom, selectedDirectChat, addOptimisticId, addMessage, stopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (hasActiveChat) {
        stopTyping();
      }
    };
  }, [hasActiveChat, stopTyping]);

  return (
    <div className="flex gap-2 p-2 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Input
        ref={inputRef}
        value={text}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={hasActiveChat ? "Type a message..." : "Select a room or chat to start messaging..."}
        className="flex-1 min-h-[44px] resize-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        disabled={isSending}
      />
      <Button
        onClick={handleSend}
        disabled={!canSend || isSending}
        className="gap-2 h-[44px] px-4"
        size="sm"
      >
        <Send className="w-4 h-4" />
        {isSending ? "Sending..." : "Send"}
      </Button>
    </div>
  );
}