export interface IRoom {
     id: string;
     name: string;
     is_private: boolean;
     created_at: string;
     created_by: string | null;
}

export interface IRoomParticipant {
     created_at: string;
     joined_at: string | null; // Updated to allow null
     room_id: string;
     status: string | null; // Updated to allow null
     user_id: string;
}