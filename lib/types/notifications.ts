// lib/types/notifications.ts
import { Database } from "./supabase";

export type ProfileType = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

export type RoomType = {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
  is_private: boolean;
};

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationWithRelations = NotificationRow & {
  sender: ProfileType | null;
  recipient: ProfileType | null;
  room: RoomType | null;
};

export interface Inotification {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: string;
  sender_id: string | null;
  user_id: string;
  room_id: string | null;
  join_status: string | null;
  direct_chat_id: string | null;
  users: ProfileType | null;
  recipient: ProfileType | null;
  rooms: RoomType | null;
}