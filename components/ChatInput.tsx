// components/ChatInput.tsx - FULL: RoomContext for user/room, typing on input change, optimistic send, keyboard support, cleanup, fast UX
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

  // UPDATED: Use RoomContext for roomId/userId, pass only roomId to hook (internal user pull)
  const roomId = selectedRoom?.id || "";
  const { startTyping, stopTyping } = useTypingStatus({ roomId });

  const canSend = Boolean(text.trim()) && !isSending && (selectedRoom || selectedDirectChat) && user;

  // Input change: Typing logic
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    if (newText.trim().length > 0 && roomId && user) {
      startTyping();
    } else if (roomId && user) {
      stopTyping();
    }
  }, [startTyping, stopTyping, roomId, user]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!canSend) return;

    setIsSending(true);
    stopTyping();

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
    const sendText = text.trim();
    setText("");

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom?.id,
          directChatId: selectedDirectChat?.id,
          text: sendText,
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
    }
  }, [canSend, text, user, selectedRoom, selectedDirectChat, addOptimisticId, addMessage, stopTyping]);

  // Keyboard send
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Cleanup typing on unmount/room change
  useEffect(() => {
    return () => {
      if (roomId && user) stopTyping();
    };
  }, [roomId, user, stopTyping]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId]);

  if (!user || (!selectedRoom && !selectedDirectChat)) return null;

  return (
    <div className="flex gap-2 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
      <Input
        ref={inputRef}
        value={text}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={isSending || !canSend}
        className="flex-1 min-h-[44px] resize-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />
      <Button
        onClick={handleSend}
        disabled={!canSend}
        className="gap-2 h-[44px] px-4"
        size="sm"
      >
        <Send className="w-4 h-4" />
        {isSending ? "Sending..." : "Send"}
      </Button>
    </div>
  );
}