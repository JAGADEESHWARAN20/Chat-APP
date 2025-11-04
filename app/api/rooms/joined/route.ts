// app/api/rooms/joined/route.ts
import { NextRequest } from "next/server";
import { withAuth, successResponse, errorResponse } from "@/lib/api-utils";

interface Room {
  id: string;
  name: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
}

interface Membership {
  room_id: string;
  status: string;
  rooms: Room;
}

interface RoomWithCount extends Room {
  isMember: boolean;
  participationStatus: "accepted";
  memberCount: number;
}

export async function GET(req: NextRequest) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { searchParams } = new URL(req.url);
      const searchQuery = searchParams.get("q")?.toLowerCase() || "";

      // Get all rooms where user is an accepted member
      const { data: memberships, error: membershipError } = await supabase
        .from("room_members")
        .select(`
          room_id,
          status,
          rooms!inner (
            id, name, is_private, created_by, created_at
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "accepted") as { data: Membership[] | null; error: any };

      if (membershipError) {
        console.error("[Rooms Joined] Memberships fetch error:", membershipError);
        return errorResponse("Failed to fetch memberships", "FETCH_ERROR", 500);
      }

      if (!memberships || memberships.length === 0) {
        return successResponse({ rooms: [] });
      }

      // Extract rooms from memberships
      const rooms: Room[] = memberships.map((m: Membership) => m.rooms);

      // Filter by search query if provided
      const filteredRooms = searchQuery 
        ? rooms.filter((room: Room) => room.name.toLowerCase().includes(searchQuery))
        : rooms;

      const roomIds = filteredRooms.map((room: Room) => room.id);

      if (roomIds.length === 0) {
        return successResponse({ rooms: [] });
      }

      // Fetch member counts efficiently using count API
      const memberCountPromises = roomIds.map(async (roomId: string) => {
        const { count, error } = await supabase
          .from("room_members")
          .select("*", { count: 'exact', head: true })
          .eq("room_id", roomId)
          .eq("status", "accepted");

        return { roomId, count: error ? 0 : (count || 0) };
      });

      const memberCounts = await Promise.all(memberCountPromises);
      
      // Create count map
      const countsMap = new Map<string, number>();
      memberCounts.forEach(({ roomId, count }) => {
        countsMap.set(roomId, count);
      });

      // Format response
      const joinedRooms: RoomWithCount[] = filteredRooms.map((room: Room) => ({
        ...room,
        isMember: true,
        participationStatus: "accepted" as const,
        memberCount: countsMap.get(room.id) || 0,
      }));

      return successResponse({ rooms: joinedRooms });
    } catch (error) {
      console.error("[Rooms Joined] Unexpected error:", error);
      return errorResponse("Unexpected error occurred", "INTERNAL_ERROR", 500);
    }
  });
}

// Add other HTTP methods for completeness
export async function POST() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function PUT() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function DELETE() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function PATCH() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}