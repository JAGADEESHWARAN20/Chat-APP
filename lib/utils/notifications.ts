import { Database } from "@/lib/types/supabase";
import { Inotification } from "@/lib/store/notifications";

type User = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RawNotification = Database["public"]["Tables"]["notifications"]["Row"];

export const transformNotification = (
     notif: RawNotification & {
          users?: User | User[] | null;
          recipient?: User | User[] | null;
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
          content: notif.message,
          created_at: notif.created_at ?? null,
          is_read: notif.status === "read",
          type: notif.type,
          sender_id: notif.sender_id ?? "",
          user_id: notif.user_id,
          room_id: notif.room_id,
          users: users
               ? {
                    id: users.id,
                    username: users.username,
                    display_name: users.display_name,
                    avatar_url: users.avatar_url,
               }
               : null,
          recipient: recipient
               ? {
                    id: recipient.id,
                    username: recipient.username,
                    display_name: recipient.display_name,
                    avatar_url: recipient.avatar_url,
               }
               : null,
          rooms: rooms ? { id: rooms.id, name: rooms.name } : null,
     };
};



export function transformUser(user: User | null) {
     if (!user) return null;

     return {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          created_at: user.created_at,
     };
}