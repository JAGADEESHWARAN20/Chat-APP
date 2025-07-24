import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useTypingStatus(roomId: string, currentUserId: string) {
  const supabase = supabaseBrowser();
  const [typingUsers, setTypingUsers] = useState<string[]>([]); // user IDs who are typing

  useEffect(() => {
    if (!roomId) return;

    // 1. Fetch initial typing users on mount
    async function fetchTypingUsers() {
      const { data, error } = await supabase
        .from("typing_status")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("is_typing", true);

      if (!error && data) {
        setTypingUsers(data.map((row) => row.user_id).filter((id) => id !== currentUserId));
      }
    }
    fetchTypingUsers();

    // 2. Subscribe to realtime changes on typing_status for this room
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
        (payload) => {
          const row = payload.new;

          if (row && row.is_typing) {
            // Someone started typing
            setTypingUsers((prev) => {
              if (!prev.includes(row.user_id) && row.user_id !== currentUserId) {
                return [...prev, row.user_id];
              }
              return prev;
            });
          } else {
            // Someone stopped typing or row deleted
            const userIdToRemove = payload.old?.user_id || row?.user_id;
            setTypingUsers((prev) => prev.filter((id) => id !== userIdToRemove));
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase]);

  return typingUsers; // array of user IDs typing other than current user
}
