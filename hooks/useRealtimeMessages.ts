// lib/hooks/useRealtimeMessages.ts
"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/store/user";
import { useMessage, Imessage } from "@/lib/store/messages";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/supabase";

export const useRealtimeMessages = (roomId?: string, directChatId?: string) => {
  const user = useUser((state) => state.user);
  const addMessage = useMessage((state) => state.addMessage);

  useEffect(() => {
    if (!roomId && !directChatId) return;

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channelName = roomId
      ? `room-${roomId}-notifications`
      : `direct-chat-${directChatId}-notifications`;

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "new-message" }, (payload) => {
        const { message } = payload.payload;

        // Skip if the message is from the current user (sender)
        if (message.sender_id === user?.id) {
          console.log("Skipping message from self:", message);
          return;
        }

        // Add the broadcasted message
        const newMessage: Imessage = {
          id: message.id,
          text: message.text,
          sender_id: message.sender_id,
          room_id: roomId || null,
          direct_chat_id: directChatId || null,
          created_at: message.created_at,
          status: "sent",
          is_edited: false,
          dm_thread_id: null,
          users: message.sender,
        };

        addMessage(newMessage);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, directChatId, user, addMessage]);
};
