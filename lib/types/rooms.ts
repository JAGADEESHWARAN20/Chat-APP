export interface IRoom {
     id: string;
     name: string;
     created_by: string ;
     created_at: string;
     is_private: boolean;
}

export interface IRoomParticipant {
     room_id: string;
     user_id: string;
     status: 'pending' | 'accepted' | 'rejected';
     joined_at: string;
}