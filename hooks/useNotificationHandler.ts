// hooks/useNotificationHandler.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useNotification, type Inotification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";
import {
  useUnifiedRoomStore,
  type RoomWithMembership,
} from "@/lib/store/roomstore";

/**
 * Fetch rooms using RPC and normalize into RoomWithMembership format.
 */
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

  const rows = (data ?? []) as any[];

  return rows.map(
    (r): RoomWithMembership => ({
      id: r.id,
      name: r.name,
      is_private: r.is_private,
      created_by: r.created_by,
      created_at: r.created_at,
      isMember: Boolean(r.is_member),
      participationStatus: r.participation_status ?? null,
      memberCount: typeof r.member_count === "number" ? r.member_count : 0,
      online_users: typeof r.online_users === "number" ? r.online_users : undefined,
      unreadCount: typeof r.unread_count === "number" ? r.unread_count : undefined,
      latestMessage: typeof r.latest_message === "string" ? r.latest_message : undefined,
      latest_message_created_at: r.latest_message_created_at ?? null,
    })
  );
}

export function useNotificationHandler() {
  const { user: currentUser, authUser } = useUser();
  const {
    addNotification,
    subscribeToNotifications,
    unsubscribeFromNotifications,
  } = useNotification();

  // Roomstore bindings
  const roomStore = useUnifiedRoomStore();
  const setRooms = roomStore.setRooms; // ✅ FIXED
  const setSelectedRoomId = roomStore.setSelectedRoomId;

  const mountedRef = useRef(true);
  const userId: string | undefined = currentUser?.id || authUser?.id;

  /* -----------------------------------------
     Subscribe/Unsubscribe lifecycle
  ----------------------------------------- */
  useEffect(() => {
    mountedRef.current = true;

    if (!userId) return;

    subscribeToNotifications(userId);

    return () => {
      mountedRef.current = false;
      unsubscribeFromNotifications();
    };
  }, [userId, subscribeToNotifications, unsubscribeFromNotifications]);

  /* -----------------------------------------
     Notification Handler
  ----------------------------------------- */
  const handleNotification = useCallback(
    async (notification: Inotification) => {
      if (!mountedRef.current || !userId) return;

      await addNotification(notification);

      switch (notification.type) {
        case "join_request_accepted": {
          toast.success("Your request to join a room was accepted!", {
            description: notification.message ?? "",
          });

          const roomsData = await fetchRoomsForUser(userId);

          setRooms(roomsData); // ✅ FIXED

          if (notification.room_id) {
            const matched = roomsData.find(
              (room) => room.id === notification.room_id
            );
            if (matched) {
              setSelectedRoomId(notification.room_id);
            }
          }
          break;
        }

        case "join_request_rejected": {
          toast.error("Your join request was rejected.");
          break;
        }

        case "room_invite": {
          toast.info("You were invited to a room.");
          break;
        }

        case "user_joined": {
          toast.success("A user joined your room");
          break;
        }

        case "room_left": {
          toast.info("A user left your room");
          break;
        }

        case "message": {
          toast.info(
            `New message from ${
              notification.users?.username || "someone"
            }`,
            {
              description: notification.message,
            }
          );
          break;
        }

        default: {
          toast(notification.message ?? "New notification");
        }
      }
    },
    [addNotification, setRooms, setSelectedRoomId, userId]
  );

  return { handleNotification };
}
