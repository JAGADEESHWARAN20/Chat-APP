// lib/types/rooms.ts
import { Database } from "@/lib/types/supabase";

export type IRoom = Database["public"]["Tables"]["rooms"]["Row"];

export type RoomWithMembership = IRoom & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
  participant_count?: number;
  online_users?: number;
};
