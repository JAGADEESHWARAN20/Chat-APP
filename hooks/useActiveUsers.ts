// hooks/useActiveUsers.tsx
"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useActiveUsers(roomId: string | null) {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const supabase = useMemo(() => supabaseBrowser(), []);
  const debounceRef = useRef<number | null>(null);
  const chanRef = useRef<any>(null);

  // FIX: Memoize fetchCounts so it can be safely used in useEffect
  const fetchCounts = useCallback(
    async (rId: string) => {
      try {
        const { count: membersCount } = await supabase
          .from("room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", rId)
          .eq("status", "accepted")
          .eq("active", true); // only active
        const { count: participantsCount } = await supabase
          .from("room_participants")
          .select("*", { count: "exact", head: true })
          .eq("room_id", rId)
          .eq("status", "accepted");
        const total = (membersCount ?? 0) + (participantsCount ?? 0);
        setActiveUsers(total);
      } catch (err) {
        console.error("[useActiveUsers] fetchCounts error:", err);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!roomId) {
      setActiveUsers(0);
      return;
    }

    // initial fetch
    fetchCounts(roomId);

    // create a channel for both tables; we handle payloads and debounce DB calls
    const channel = supabase
      .channel(`room-presence-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const oldActive = payload.old?.active;
            const newActive = payload.new?.active;
            if (oldActive === newActive) return;
          }
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => fetchCounts(roomId), 200);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        () => {
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => fetchCounts(roomId), 200);
        }
      )
      .subscribe();

    chanRef.current = channel;

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn("[useActiveUsers] removeChannel error:", err);
      }
    };
  }, [roomId, supabase, fetchCounts]); // <-- add fetchCounts here

  return activeUsers;
}
