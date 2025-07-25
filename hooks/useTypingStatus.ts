import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

type TypingStatusRow = Database["public"]["Tables"]["typing_status"]["Row"];

function isTypingStatusRow(obj: any): obj is TypingStatusRow {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "user_id" in obj &&
    "is_typing" in obj &&
    typeof obj.user_id === "string"
  );
}

export function useTypingStatus(roomId: string, currentUserId: string) {
  const supabase = supabaseBrowser();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId) return;

    async function fetchTypingUsers() {
      // no generic on .from(), so supabase infers any
      const { data, error } = await supabase
        .from("typing_status")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("is_typing", true);

      if (!error && data) {
        const typedData = data as TypingStatusRow[];
        setTypingUsers(
          typedData.map((row) => row.user_id).filter((id) => id !== currentUserId)
        );
      }
    }
    fetchTypingUsers();

   const channel = supabase
  .channel(`public:typing_status:room_id=eq.${roomId}`)
 .on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "typing_status",
    filter: `room_id=eq.${roomId}`,
  },
  (payload: RealtimePostgresChangesPayload<TypingStatusRow>) => {
    const row = payload.new;
    if (isTypingStatusRow(row) && row.is_typing) {
      setTypingUsers((prev) => {
        if (!prev.includes(row.user_id) && row.user_id !== currentUserId) {
          return [...prev, row.user_id];
        }
        return prev;
      });
    } else {
      const userIdToRemove = isTypingStatusRow(payload.old)
        ? payload.old.user_id
        : isTypingStatusRow(row)
        ? row.user_id
        : undefined;

      if (userIdToRemove) {
        setTypingUsers((prev) => prev.filter((id) => id !== userIdToRemove));
      }
    }
  }  // <-- closing the arrow function here
)    // <-- closing the .on() call here
.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase]);

  return typingUsers;
}
