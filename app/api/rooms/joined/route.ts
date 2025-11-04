import { NextRequest } from "next/server";
import { withAuth, successResponse, errorResponse } from "@/lib/api-utils";

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
        .eq("status", "accepted");

      if (membershipError) {
        console.error("[Rooms Joined] Memberships fetch error:", membershipError);
        return errorResponse("Failed to fetch memberships", "FETCH_ERROR", 500);
      }

      if (!memberships || memberships.length === 0) {
        return successResponse({ rooms: [] });
      }

      // Extract rooms from memberships
      const rooms = memberships.map(m => m.rooms);

      // Filter by search query if provided
      const filteredRooms = searchQuery 
        ? rooms.filter(room => room.name.toLowerCase().includes(searchQuery))
        : rooms;

      const roomIds = filteredRooms.map(room => room.id);

      // Fetch member counts efficiently
      const { data: memberCounts, error: countError } = await supabase
        .from("room_members")
        .select("room_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      if (countError) {
        console.error("[Rooms Joined] Member counts error:", countError);
        // Continue with zero counts
      }

      // Create count map
      const countsMap = new Map<string, number>();
      memberCounts?.forEach(({ room_id }) => {
        countsMap.set(room_id, (countsMap.get(room_id) || 0) + 1);
      });

      // Format response
      const joinedRooms = filteredRooms.map((room) => ({
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