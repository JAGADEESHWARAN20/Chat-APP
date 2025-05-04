export interface RawNotification {
     id: string;
     message: string;
     created_at: string | null;
     status: string | null;
     type: string;
     sender_id: string | null;
     user_id: string;
     room_id: string | null;
     users: { id: string; username: string; display_name: string; avatar_url: string | null; created_at: string } | null;
     recipient: { id: string; username: string; display_name: string; avatar_url: string | null; created_at: string } | null;
     rooms: { id: string; name: string; created_at: string; created_by: string | null; is_private: boolean } | null;
}