"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/supabase";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export function useMessagePagination(roomId: string, limit = 20) {
  const supabase = getSupabaseBrowserClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const lastMessageId = useRef<string | null>(null); // Fixed: changed from number to string

  // 🧩 Fetch messages in pages
  const fetchMessages = useCallback(
    async (initial = false) => {
      if (!roomId || (!initial && !hasMore)) return;

      setLoading(true);
      const query = supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!initial && lastMessageId.current) {
        query.lt("id", lastMessageId.current);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching messages:", error.message);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setMessages((prev) =>
          initial
            ? data.reverse()
            : [...data.reverse(), ...prev] // append older messages
        );
        lastMessageId.current = data[data.length - 1].id; // This is a string
      } else {
        setHasMore(false);
      }

      setLoading(false);
    },
    [roomId, supabase, limit, hasMore]
  );

  // 🧠 Initial fetch
  useEffect(() => {
    fetchMessages(true);
  }, [fetchMessages]); // Fixed: added fetchMessages to dependencies

  // ⚡ Real-time updates (new messages)
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]); // Fixed: added supabase to dependencies

  return { messages, loading, hasMore, fetchMessages };
}