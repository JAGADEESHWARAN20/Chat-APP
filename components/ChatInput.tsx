"use client";

import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "@/lib/store/user";
import { useRoomContext } from "@/lib/store/RoomContext";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Imessage } from "@/lib/store/messages";

export default function ChatInput() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = supabaseBrowser();

  const user = useUser((state) => state.user);
  const { state, addMessage } = useRoomContext();
  const { selectedRoom, selectedDirectChat } = state;

  const sendMessage = async () => {
    if (!user || !text.trim()) return;

    setLoading(true);

    const newMessage: Imessage = {
      id: uuidv4(),
      sender_id: user.id,
      room_id: selectedRoom?.id ?? null,
      direct_chat_id: selectedDirectChat?.id ?? null,
      dm_thread_id: null, // ✅ required by type
      text,
      created_at: new Date().toISOString(),
      is_edited: false, // ✅ required by type
      status: "sent", // ✅ required by type
      profiles: {
        id: user.id,
        display_name: user.display_name ?? "",
        avatar_url: user.avatar_url ?? "",
        username: user.username ?? "",
        bio: user.bio ?? "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    // Optimistic update
    addMessage(newMessage);
    setText("");

    // Persist to DB
    const { error } = await supabase.from("messages").insert({
      id: newMessage.id,
      sender_id: newMessage.sender_id,
      room_id: newMessage.room_id,
      direct_chat_id: newMessage.direct_chat_id,
      dm_thread_id: newMessage.dm_thread_id,
      text: newMessage.text,
      is_edited: newMessage.is_edited,
      status: newMessage.status,
    });

    if (error) {
      console.error("Error sending message:", error);
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 p-2 border-t">
      <input
        type="text"
        className="flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type your message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) sendMessage();
        }}
      />
      <button
        className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
        onClick={sendMessage}
        disabled={loading || !text.trim()}
      >
        {loading ? "..." : "Send"}
      </button>
    </div>
  );
}
