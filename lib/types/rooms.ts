export interface IRoom {
  id: string;
  name: string;
  is_private: boolean;
  created_at: string;
  created_by: string | null;
  memberCount?: number; // Optional until populated by API or calculation
}

export interface IRoomParticipant {
  created_at: string | null;
  joined_at: string | null; // Updated to allow null
  room_id: string;
  status: string | null; // Updated to allow null
  user_id: string;
}