// ChatInput.tsx
"use client";

import { useState } from "react";
import { useMessage } from "@/lib/store/messages";
import { useRoomContext } from "@/lib/store/RoomContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Imessage } from "@/lib/store/messages";
import { Send } from "lucide-react"

export default function ChatInput({ user }: { user: SupabaseUser }) {
  const [text, setText] = useState("");
  const { addMessage, addOptimisticId } = useMessage();
  const { state } = useRoomContext();
  const { selectedRoom, selectedDirectChat } = state;

  // ChatInput.tsx
  // ChatInput.tsx (inside handleSend)
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
      // Optionally remove optimistic message on failure
      // useMessage.getState().optimisticDeleteMessage(optimisticId);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />
      <Button onClick={handleSend}><Send className="w-[2em] h-[2em]" /></Button>
    </div>
  );
}