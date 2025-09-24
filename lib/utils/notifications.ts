import { Database } from "@/lib/types/supabase";
import { Inotification } from "@/lib/store/notifications";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RawNotification = Database["public"]["Tables"]["notifications"]["Row"];

export const transformNotification = (
  notif: RawNotification & {
    users?: Profile | Profile[] | null;
    recipient?: Profile | Profile[] | null;
    rooms?: Room | Room[] | null;
  }
): Inotification => {
  const users = Array.isArray(notif.users)
    ? notif.users.length > 0
      ? notif.users[0]
      : null
    : notif.users || null;

  const recipient = Array.isArray(notif.recipient)
    ? notif.recipient.length > 0
      ? notif.recipient[0]
      : null
    : notif.recipient || null;

  const rooms = Array.isArray(notif.rooms)
    ? notif.rooms.length > 0
      ? notif.rooms[0]
      : null
    : notif.rooms || null;

  return {
    id: notif.id,
    message: notif.message,
    created_at: notif.created_at ?? null,
    status: notif.status,
    type: notif.type,
    sender_id: notif.sender_id ?? "",
    user_id: notif.user_id,
    room_id: notif.room_id ?? null,
    join_status: notif.join_status,
    direct_chat_id: notif.direct_chat_id ?? null,
    users: users
      ? {
          id: users.id,
          username: users.username,
          display_name: users.display_name,
          avatar_url: users.avatar_url ?? null,
          created_at: users.created_at,
        }
      : null,
    recipient: recipient
      ? {
          id: recipient.id,
          username: recipient.username,
          display_name: recipient.display_name,
          avatar_url: recipient.avatar_url ?? null,
          created_at: recipient.created_at,
        }
      : null,
    rooms: rooms
      ? {
          id: rooms.id,
          name: rooms.name,
          created_at: rooms.created_at,
          created_by: rooms.created_by ?? "",
          is_private: rooms.is_private,
        }
      : null,
  };
};