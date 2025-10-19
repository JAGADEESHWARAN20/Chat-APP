// components/ChatInput.tsx - COMPLETE WORKING VERSION
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMessage } from "@/lib/store/messages";
import { useRoomContext } from "@/lib/store/RoomContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Imessage } from "@/lib/store/messages";
import { Send } from "lucide-react";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function ChatInput({ user }: { user: SupabaseUser }) {
  const [text, setText] = useState("");
  const { addMessage, addOptimisticId } = useMessage();
  const { state } = useRoomContext();
  const { selectedRoom, selectedDirectChat } = state;
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Get typing functionality from hook
  const { startTyping } = useTypingStatus(
    selectedRoom?.id || "",
    user?.id || null
  );

  console.log("[ChatInput] Render:", {
    hasRoom: !!selectedRoom?.id,
    hasUser: !!user?.id,
  });

  // Handle input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newText = e.target.value;
      setText(newText);

      console.log("[ChatInput] Input changed:", {
        textLength: newText.length,
        isTrimmed: newText.trim().length > 0,
        roomId: selectedRoom?.id,
      });

      // Only trigger typing when text is being added
      if (newText.trim().length > 0 && selectedRoom?.id) {
        console.log("[ChatInput] ⌨️ Starting typing indicator");
        startTyping();
      }
    },
    [startTyping, selectedRoom?.id]
  );

  const handleSend = async () => {
    console.log("[ChatInput] Send button clicked", {
      hasUser: !!user,
      textLength: text.trim().length,
      hasRoom: !!selectedRoom,
      hasDirectChat: !!selectedDirectChat,
    });

    if (!user) {
      toast.error("You must be logged in to send messages");
      return;
    }

    if (!text.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    if (!selectedRoom && !selectedDirectChat) {
      toast.error("No room or direct chat selected");
      return;
    }

    // Clear typing timeout if any
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

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
        display_name: user.user_metadata?.display_name || user.email || "",
        avatar_url: user.user_metadata?.avatar_url || "",
        username: user.user_metadata?.username || "",
        created_at: user.created_at,
        updated_at: null,
        bio: null,
      },
    };

    console.log("[ChatInput] 📤 Sending optimistic message:", optimisticId);

    addOptimisticId(optimisticId);
    addMessage(optimisticMessage);
    setText("");

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom?.id,
          directChatId: selectedDirectChat?.id,
          text: text.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message");
      }

      console.log("[ChatInput] ✅ Message sent successfully");
      toast.success("Message sent");
    } catch (error) {
      console.error("[ChatInput] ❌ Error sending message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[ChatInput] 🧹 Unmounting");
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex gap-2 w-full">
      <Input
        value={text}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={!selectedRoom && !selectedDirectChat}
        className="flex-1"
      />
      <Button
        onClick={handleSend}
        disabled={!selectedRoom && !selectedDirectChat}
        className="gap-2"
      >
        <Send className="w-[1.2em] h-[1.2em]" />
      </Button>
    </div>
  );
}