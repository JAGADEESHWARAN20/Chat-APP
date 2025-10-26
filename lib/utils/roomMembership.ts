// lib/utils/roomMembership.ts
import { supabaseBrowser } from "@/lib/supabase/browser";

export interface RoomMembershipStatus {
  isMember: boolean;
  participationStatus: string | null;
  isPending: boolean;
  isAccepted: boolean;
}

export async function checkUserRoomMembership(
  userId: string, 
  roomId: string
): Promise<RoomMembershipStatus> {
  const supabase = supabaseBrowser();
  
  try {
    // Check both tables simultaneously
    const [membersResult, participantsResult] = await Promise.all([
      // Check room_members table
      supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single(),
      
      // Check room_participants table  
      supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single()
    ]);

    const memberStatus = membersResult.data?.status;
    const participantStatus = participantsResult.data?.status;

    // User is considered a member if they have "accepted" status in either table
    const isAccepted = memberStatus === 'accepted' || participantStatus === 'accepted';
    const isPending = memberStatus === 'pending' || participantStatus === 'pending';
    
    return {
      isMember: isAccepted,
      participationStatus: memberStatus || participantStatus || null,
      isPending,
      isAccepted
    };
  } catch (error) {
    console.error(`Error checking membership for user ${userId} in room ${roomId}:`, error);
    return {
      isMember: false,
      participationStatus: null,
      isPending: false,
      isAccepted: false
    };
  }
}

export async function getRoomMemberCount(roomId: string): Promise<number> {
  const supabase = supabaseBrowser();
  
  try {
    // Count unique users who are accepted members in either table
    const [membersResult, participantsResult] = await Promise.all([
      supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("status", "accepted"),
      
      supabase
        .from("room_participants")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("status", "accepted")
    ]);

    const memberUserIds = new Set(membersResult.data?.map(m => m.user_id) || []);
    const participantUserIds = new Set(participantsResult.data?.map(p => p.user_id) || []);
    
    // Combine both sets to get unique user count
    const allUserIds = new Set([...memberUserIds, ...participantUserIds]);
    
    return allUserIds.size;
  } catch (error) {
    console.error(`Error counting members for room ${roomId}:`, error);
    return 0;
  }
}