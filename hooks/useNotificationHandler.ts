"use client";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useNotification, Inotification } from "@/lib/store/notifications";
import { useEffect, useRef } from "react";
import { useUser } from "@/lib/store/user";
import { useRoomContext } from "@/lib/store/RoomContext";


async function fetchRoomsForUser(userId: string) {
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

  return (data || []).map((room: any) => ({
    ...room,
    isMember: room.is_member,
    participationStatus: room.participation_status,
    participant_count: room.member_count,
  }));
}

export function useNotificationHandler() {
  const { user: currentUser, authUser } = useUser();
  const { addNotification } = useNotification();
  const roomStore = useRoomContext();

  const setRooms = roomStore.setAvailableRooms;
  const setSelectedRoomId = roomStore.setSelectedRoomId;

  const mountedRef = useRef(true);
  const userId = currentUser?.id || authUser?.id;

  useEffect(() => {
    mountedRef.current = true;
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();

    const subscription = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async ({ new: raw }) => {
          if (!mountedRef.current) return;

          const notification: Inotification = {
            id: raw.id,
            message: raw.message,
            created_at: raw.created_at,
            status: raw.status,
            type: raw.type,
            sender_id: raw.sender_id,
            user_id: raw.user_id,
            room_id: raw.room_id,
            join_status: raw.join_status,
            direct_chat_id: raw.direct_chat_id,
            users: raw.sender ?? null,
            recipient: raw.recipient ?? null,
            rooms: raw.room ?? null,
          };

          await addNotification(notification);

          switch (notification.type) {
            case "join_request_accepted": {
              toast.success("Your request to join a room was accepted!", {
                description: notification.message ?? "",
              });
            
              const { data, error } = await supabase.rpc("get_rooms_with_counts", {
                p_user_id: userId,
                p_query: undefined,
                p_include_participants: true,
              });
            
              if (error) {
                console.error("RPC error:", error);
                break;
              }
            
              const roomsData = (data || []).map((r: any) => ({
                id: r.id,
                name: r.name,
                is_private: r.is_private,
                created_by: r.created_by,
                created_at: r.created_at,
                isMember: r.is_member,
                participationStatus: r.participation_status,
                memberCount: r.member_count,
              }));
            
              // 🔥 Update RoomContext store
              setRooms(roomsData);
            
              // 🔥 Auto-open room in UI
              if (notification.room_id) {
                const matched = roomsData.find((x) => x.id === notification.room_id);
                if (matched) {
                  setSelectedRoomId(notification.room_id);
                }
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
              toast.success("A user joined your room");
              break;

            case "room_left":
              toast.info("A user left your room");
              break;

            case "message":
              toast.info(`New message from ${notification.users?.username || "someone"}`, {
                description: notification.message,
              });
              break;

            default:
              toast(notification.message ?? "New notification");
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [userId, addNotification, setRooms]);
}
