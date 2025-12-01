"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import { useNotifications, type Notification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";

import {
  useUnifiedStore,
  type RoomData,
} from "@/lib/store/unified-roomstore";

/* -------------------------------------------------------
   Fetch rooms from RPC using unified RoomData type
------------------------------------------------------- */
async function fetchRoomsForUser(userId: string): Promise<RoomData[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.rpc("get_unified_room_data", {
    p_user_id: userId,
  });

  if (error) {
    console.error("get_unified_room_data error:", error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    ...r,
    participation_status:
      r.participation_status === "accepted" ||
      r.participation_status === "pending" ||
      r.participation_status === "rejected"
        ? r.participation_status
        : null,
    online_users: r.online_users ?? 0,
    unread_count: r.unread_count ?? 0,
  }));
}

/* -------------------------------------------------------
   Hook
------------------------------------------------------- */
export function useNotificationHandler() {
  const { user: profileUser, authUser } = useUser();
  const userId = profileUser?.id || authUser?.id;

  const { add, subscribe, unsubscribe } = useNotifications();

  const setRooms = useUnifiedStore((s) => s.setRooms);
  const setSelectedRoomId = useUnifiedStore((s) => s.setSelectedRoomId);

  const mounted = useRef(true);

  /* Subscribe to realtime notifications */
  useEffect(() => {
    mounted.current = true;

    if (!userId) return;

    subscribe(userId);

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [userId, subscribe, unsubscribe]);

  /* Handle incoming notifications */
  const handleNotification = useCallback(
    async (notif: Notification) => {
      if (!mounted.current || !userId) return;

      add(notif);

      switch (notif.type) {
        case "join_request_accepted": {
          toast.success("Your request to join a room was accepted!", {
            description: notif.message ?? "",
          });

          const updated = await fetchRoomsForUser(userId);
          setRooms(updated);

          if (notif.room_id) {
            setSelectedRoomId(notif.room_id);
          }
          break;
        }

        case "join_request_rejected":
          toast.error("Your join request was rejected.");
          break;

        case "room_invite":
          toast.info("You were invited to a room.");
          break;

        case "message":
          toast.info(
            `New message from ${notif.users?.username ||
              notif.users?.display_name ||
              "someone"
            }`,
            { description: notif.message }
          );
          break;

        default:
          toast(notif.message ?? "New notification");
      }
    },
    [add, setRooms, setSelectedRoomId, userId]
  );

  return { handleNotification };
}
