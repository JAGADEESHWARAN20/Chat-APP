// Define the raw notification type from Supabase (before transformation)
export interface RawNotification {
     id: string;
     message: string; // Original column name
     created_at: string;
     status: string; // Original column name
     type: string;
     sender_id: string;
     room_id: string | null;
     user_id: string; // Include user_id
     users: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string;
     } | null;
     rooms: {
          id: string;
          name: string;
     } | null;
}