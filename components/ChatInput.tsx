// ChatInput.tsx - Updated version with broadcast
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
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";

export default function ChatInput({ user }: { user: SupabaseUser }) {
  const [text, setText] = useState("");
  const { addMessage, addOptimisticId } = useMessage();
  const { state } = useRoomContext();
  const { selectedRoom, selectedDirectChat } = state;
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const supabase = createClientComponentClient<Database>();

  // Get typing functionality
  const { startTyping } = useTypingStatus(
    selectedRoom?.id || "", 
    user?.id || null
  );

  // Broadcast typing status to other users
  const broadcastTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!selectedRoom?.id || !user?.id) return;
    
    try {
      await (supabase.channel as any)(`typing-broadcast-${selectedRoom.id}`).send({
        type: 'broadcast',
        event: isTyping ? 'user_typing' : 'user_stopped_typing',
        payload: {
          user_id: user.id,
          room_id: selectedRoom.id,
          updated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error broadcasting typing status:", error);
    }
  }, [selectedRoom?.id, user?.id, supabase]);

  // Handle input changes with optimized typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Trigger typing indicator
    if (newText.trim() && selectedRoom?.id) {
      startTyping();
      broadcastTypingStatus(true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTypingStatus(false);
      }, 2000);
    } else if (!newText.trim()) {
      // If text is empty, stop typing immediately
      broadcastTypingStatus(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [startTyping, broadcastTypingStatus, selectedRoom?.id]);

  const handleSend = async () => {
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

    // Stop typing when sending message
    broadcastTypingStatus(false);
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
        display_name: user.user_metadata.display_name || user.email || "",
        avatar_url: user.user_metadata.avatar_url || "",
        username: user.user_metadata.username || "",
        created_at: user.created_at,
        updated_at: null,
        bio: null,
      },
    };

    addOptimisticId(optimisticId);
    addMessage(optimisticMessage);

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

      setText("");
      toast.success("Message sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
      />
      <Button onClick={handleSend}>
        <Send className="w-[1.2em] h-[1.2em]" />
      </Button>
    </div>
  );
}