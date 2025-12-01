"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  useNotifications,
  type Notification,
} from "@/lib/store/notifications";

import { useUser } from "@/lib/store/user";
import {
  useUnifiedRoomStore,
  type RoomWithMembership,
} from "@/lib/store/unused/roomstore";

/* -------------------------------------------------------
   Fetch rooms from RPC
------------------------------------------------------- */
async function fetchRoomsForUser(userId: string): Promise<RoomWithMembership[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.rpc("get_rooms_with_counts", {
    p_user_id: userId,
    p_query: undefined,
    p_include_participants: true,
  });

  if (error) {
    console.error("get_rooms_with_counts error:", error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    is_private: r.is_private,
    created_by: r.created_by,
    created_at: r.created_at,

    isMember: Boolean(r.is_member),
    participationStatus: r.participation_status ?? null,

    memberCount: r.member_count ?? 0,
    online_users: r.online_users ?? 0,
    unreadCount: r.unread_count ?? 0,

    latestMessage: r.latest_message ?? null,
    latest_message_created_at: r.latest_message_created_at ?? null,
  }));
}

/* -------------------------------------------------------
   Hook
------------------------------------------------------- */
export function useNotificationHandler() {
  const { user: profileUser, authUser } = useUser();
  const userId = profileUser?.id || authUser?.id;

  /* store APIs */
  const { add, subscribe, unsubscribe } = useNotifications();

  const { setRooms, setSelectedRoomId } = useUnifiedRoomStore();

  const mounted = useRef(true);

  /* -------------------------------------------------------
     Subscribe to realtime notifications
  ------------------------------------------------------- */
  useEffect(() => {
    mounted.current = true;

    if (!userId) return;

    subscribe(userId);

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [userId, subscribe, unsubscribe]);

  /* -------------------------------------------------------
     Handle incoming notifications
  ------------------------------------------------------- */
  const handleNotification = useCallback(
    async (notif: Notification) => {
      if (!mounted.current || !userId) return;

      // Add to store
      add(notif);

      switch (notif.type) {
        /* user’s join request accepted */
        case "join_request_accepted": {
          toast.success("Your request to join a room was accepted!", {
            description: notif.message ?? "",
          });

          const updated = await fetchRoomsForUser(userId);
          setRooms(updated);

          if (notif.room_id) {
            const room = updated.find((r) => r.id === notif.room_id);
            if (room) setSelectedRoomId(notif.room_id);
          }
          break;
        }

        case "join_request_rejected":
          toast.error("Your join request was rejected.");
          break;

        case "room_invite":
          toast.info("You were invited to a room.");
          break;

        case "user_joined":
          toast.success("A user joined your room.");
          break;

        case "room_left":
          toast.info("A user left your room.");
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
