"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMessage } from "@/lib/store/messages";
// import { useSelectedRoom, useRoomActions } from "@/lib/store/RoomContext";
import { useUser } from "@/lib/store/user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner"
import { v4 as uuidv4 } from "uuid";
import { Imessage } from "@/lib/store/messages";
import { Send, Loader2 } from "lucide-react";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomActions, useSelectedRoom } from "@/lib/store/roomstore";

export default function ChatInput() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addMessage, setOptimisticIds, optimisticDeleteMessage } = useMessage();

  
  // ✅ FIXED: Use Zustand selectors
  const selectedRoom = useSelectedRoom();
  const { sendMessage } = useRoomActions();
  const user = useUser((state) => state.user);

  // FIXED: Use handleTyping instead of start/stop directly
  const { handleTyping, stopTyping } = useTypingStatus();

  // ✅ FIXED: Update canSend and hasActiveChat to only check selectedRoom
  const canSend = Boolean(text.trim()) && !isSending && selectedRoom && user;
  const hasActiveChat = Boolean(selectedRoom);

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
    if (!canSend || !selectedRoom?.id) return;

    setIsSending(true);
    stopTyping(); // Stop typing when sending

    const optimisticId = uuidv4();
    const optimisticMessage: Imessage = {
      id: optimisticId,
      text: text.trim(),
      sender_id: user!.id,
      room_id: selectedRoom.id,
      direct_chat_id: null,
      dm_thread_id: null,
      created_at: new Date().toISOString(),
      is_edited: false,
      status: "sending",
      profiles: {
        id: user!.id,
        display_name:
          user!.user_metadata?.display_name ||
          user!.user_metadata?.full_name ||
          user!.user_metadata?.name ||
          user!.user_metadata?.username ||
          null,
        avatar_url: user!.user_metadata?.avatar_url || "",
        username: user!.user_metadata?.username || null,
        created_at: user!.created_at,
        updated_at: null,
        bio: null,
      },
      
    };

    setOptimisticIds(optimisticId);
    addMessage(optimisticMessage);
    setText("");
    
    try {
      // ✅ FIXED: Use the room store's sendMessage action
      const success = await sendMessage(selectedRoom.id, text.trim());

      if (success) {
        // remove the optimistic; the realtime INSERT will add the final message
        optimisticDeleteMessage(optimisticId);
        toast.success("Message sent");
      } else {
        throw new Error("Failed to send message");
      }

    } catch (error) {
      console.error("[ChatInput] Send error:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [canSend, text, user, selectedRoom, setOptimisticIds, addMessage, sendMessage, stopTyping, optimisticDeleteMessage]);


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
    <div className="flex gap-2 p-2 w-full border-t border-white/10  bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Input
        ref={inputRef}
        value={text}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={hasActiveChat ? `Message #${selectedRoom?.name}` : "Select a room to start messaging..."}
        className="flex-1 min-h-[44px] resize-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        disabled={isSending}
      />
      <Button
        onClick={handleSend}
        disabled={!canSend || isSending}
        className="gap-2 h-[44px] px-4"
        size="sm"
      >
        
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" />: <Send className="w-4 h-4" />}
      </Button>
    </div>
  );
}