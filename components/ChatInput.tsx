// components/ChatInput.tsx - UPDATED CORRECTED VERSION
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
import { useTypingStatus, useDebouncedTyping } from "@/hooks/useTypingStatus";

export default function ChatInput() {
  const [text, setText] = useState("");
  const { addMessage, addOptimisticId } = useMessage();
  const { state } = useRoomContext();
  const { selectedRoom, selectedDirectChat, user: contextUser } = state;

  // Get user from RoomContext instead of props
  const user = contextUser;

  // Get typing functionality - only pass roomId since useTypingStatus now gets user from RoomContext
  const { startTyping, stopTyping } = useTypingStatus(selectedRoom?.id || "");
  const { handleTyping } = useDebouncedTyping(selectedRoom?.id || "");

  console.log("[ChatInput] Render:", {
    hasRoom: !!selectedRoom?.id,
    hasDirectChat: !!selectedDirectChat?.id,
    hasUser: !!user?.id,
    userFrom: "RoomContext",
  });

  // Handle input changes with debounced typing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newText = e.target.value;
      setText(newText);

      console.log("[ChatInput] Input changed:", {
        textLength: newText.length,
        isTrimmed: newText.trim().length > 0,
        roomId: selectedRoom?.id,
        userId: user?.id,
      });

      // Trigger debounced typing indicator when text is being added
      if (newText.trim().length > 0 && selectedRoom?.id && user?.id) {
        console.log("[ChatInput] ⌨️ Triggering typing indicator");
        try {
          handleTyping();
        } catch (error) {
          console.error("[ChatInput] Error calling handleTyping:", error);
        }
      }
    },
    [handleTyping, selectedRoom?.id, user?.id]
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

    // Stop typing indicator immediately when sending
    if (selectedRoom?.id && user?.id) {
      try {
        stopTyping();
      } catch (error) {
        console.error("[ChatInput] Error stopping typing:", error);
      }
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

  // Stop typing when component unmounts or room changes
  useEffect(() => {
    return () => {
      console.log("[ChatInput] 🧹 Unmounting - stopping typing");
      if (selectedRoom?.id && user?.id) {
        try {
          stopTyping();
        } catch (error) {
          console.error("[ChatInput] Error stopping typing on unmount:", error);
        }
      }
    };
  }, [selectedRoom?.id, user?.id, stopTyping]);

  // Stop typing when text is cleared
  useEffect(() => {
    if (text.trim().length === 0 && selectedRoom?.id && user?.id) {
      try {
        stopTyping();
      } catch (error) {
        console.error("[ChatInput] Error stopping typing on text clear:", error);
      }
    }
  }, [text, selectedRoom?.id, user?.id, stopTyping]);

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
        aria-label="Type your message"
      />
      <Button
        onClick={handleSend}
        disabled={(!selectedRoom && !selectedDirectChat) || !text.trim()}
        className="gap-2"
        aria-label="Send message"
      >
        <Send className="w-[1.2em] h-[1.2em]" />
      </Button>
    </div>
  );
}