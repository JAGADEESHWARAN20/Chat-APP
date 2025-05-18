"use client";

import { useEffect, useRef } from "react";
import { useMessage, Imessage } from "@/lib/store/messages";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/supabase";

export const useRealtimeMessages = (
  roomId?: string,
  directChatId?: string,
  onNewMessage?: () => void
) => {
  const addMessage = useMessage((state) => state.addMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId && !directChatId) return;

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch the current user
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user || null;
    };

    getUser().then((user) => {
      const channelName = roomId
        ? `room-${roomId}-notifications`
        : `direct-chat-${directChatId}-notifications`;

      const channel = supabase
        .channel(channelName)
        .on("broadcast", { event: "new-message" }, (payload) => {
          const { message } = payload.payload;

          if (message.sender_id === user?.id) {
            console.log("Skipping message from self:", message);
            return;
          }

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

          if (
            scrollRef.current &&
            scrollRef.current.scrollTop <
              scrollRef.current.scrollHeight - scrollRef.current.clientHeight - 10
          ) {
            if (onNewMessage) {
              onNewMessage();
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, [roomId, directChatId, addMessage, onNewMessage]);

  return { scrollRef };
};
