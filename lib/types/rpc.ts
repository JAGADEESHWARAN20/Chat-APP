export interface JoinRoomSuccessResponse {
    success: true;
    action: 'owner_joined_private_room' | 'joined_public_room' | 'join_request_sent';
    room_name: string;
    room_id: string;
    is_private: boolean;
    status: string;
    is_member_now: boolean;
    needs_approval: boolean;
    notification_sent: boolean;
    is_own_room: boolean;
    debug: any;
  }
  
  export interface JoinRoomErrorResponse {
    success: false;
    error: 'ALREADY_MEMBER' | 'ROOM_NOT_FOUND' | 'INTERNAL_ERROR';
    message: string;
    debug: any;
  }
  
  export type JoinRoomResponse = JoinRoomSuccessResponse | JoinRoomErrorResponse;