"use client";

import { useState, useCallback, useEffect } from "react";
import { useMessage } from "@/lib/store/messages";
import { useRoomContext } from "@/lib/store/RoomContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Imessage } from "@/lib/store/messages";
import { Send } from "lucide-react";
import { useTypingStatus } from "@/hooks/useTypingStatus"; // ✅ removed useDebouncedTyping

export default function ChatInput() {
  const [text, setText] = useState("");
  const { addMessage, addOptimisticId } = useMessage();
  const { state } = useRoomContext();
  const { selectedRoom, selectedDirectChat, user } = state;

  // ✅ Fixed call: pass both roomId and userId
  const { startTyping, stopTyping } = useTypingStatus(
    selectedRoom?.id || "",
    user?.id || null
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newText = e.target.value;
      setText(newText);

      if (newText.trim().length > 0 && selectedRoom?.id && user?.id) {
        startTyping();
      } else if (selectedRoom?.id && user?.id) {
        stopTyping();
      }
    },
    [startTyping, stopTyping, selectedRoom?.id, user?.id]
  );

  const handleSend = async () => {
    if (!user) return toast.error("You must be logged in to send messages");
    if (!text.trim()) return toast.error("Message cannot be empty");
    if (!selectedRoom && !selectedDirectChat)
      return toast.error("No room or direct chat selected");

    stopTyping();

    const optimisticId = uuidv4();
    const optimisticMessage: Imessage = {
      id: optimisticId,
      text: text.trim(),
      sender_id: user.id,
      room_id: selectedRoom?.id || null,
      direct_chat_id: selectedDirectChat?.id || null,
      dm_thread_id: null,
      created_at: new Date().toISOString(),
      is_edited: false,
      status: "sent",
      profiles: {
        id: user.id,
        display_name:
          user.user_metadata?.display_name || user.email || "Anonymous",
        avatar_url: user.user_metadata?.avatar_url || "",
        username: user.user_metadata?.username || "",
        created_at: user.created_at,
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

      toast.success("Message sent");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    return () => {
      if (selectedRoom?.id && user?.id) stopTyping();
    };
  }, [selectedRoom?.id, user?.id, stopTyping]);

  return (
    <div className="flex gap-2 w-full p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Input
        value={text}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={
          !selectedRoom && !selectedDirectChat
            ? "Select a room or chat to start messaging..."
            : "Type a message..."
        }
        disabled={!selectedRoom && !selectedDirectChat}
        className="flex-1"
      />
      <Button
        onClick={handleSend}
        disabled={(!selectedRoom && !selectedDirectChat) || !text.trim()}
        className="gap-2"
      >
        <Send className="w-[1.2em] h-[1.2em]" />
      </Button>
    </div>
  );
}
