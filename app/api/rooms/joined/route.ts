// app/api/rooms/joined/route.ts
import { NextRequest } from "next/server";
import { withAuth, successResponse, errorResponse } from "@/lib/api-utils";
import type { Database } from "@/lib/types/supabase";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMember = Database["public"]["Tables"]["room_members"]["Row"];

interface MembershipRow {
  room_id: RoomMember["room_id"];
  status: RoomMember["status"];
  rooms: Room; // ✅ Single room object (NOT array)
}

interface RoomWithCount extends Room {
  isMember: true;
  participationStatus: "accepted";
  memberCount: number;
}

export async function GET(req: NextRequest) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { searchParams } = new URL(req.url);
      const searchQuery = searchParams.get("q")?.toLowerCase() || "";

      // ✅ Fetch rooms where the user is an accepted member
      const { data: memberships, error: membershipError } = await supabase
        .from("room_members")
        .select(`
          room_id,
          status,
          rooms!inner (
            id,
            name,
            is_private,
            created_by,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "accepted") as { data: MembershipRow[] | null; error: any };

      if (membershipError) {
        console.error("[Rooms Joined] Membership query error:", membershipError);
        return errorResponse("Failed to fetch rooms", "FETCH_ERROR", 500);
      }

      if (!memberships?.length) {
        return successResponse({ rooms: [] });
      }

      // ✅ Extract rooms
      let rooms = memberships.map((m) => m.rooms);

      // ✅ Apply search filtering
      if (searchQuery) {
        rooms = rooms.filter((room) =>
          room.name.toLowerCase().includes(searchQuery)
        );
      }

      if (!rooms.length) return successResponse({ rooms: [] });

      const roomIds = rooms.map((r) => r.id);

      // ✅ Fetch member counts per room efficiently
      const countResults = await Promise.all(
        roomIds.map(async (roomId) => {
          const { count } = await supabase
            .from("room_members")
            .select("*", { count: "exact", head: true })
            .eq("room_id", roomId)
            .eq("status", "accepted");

          return { roomId, count: count ?? 0 };
        })
      );

      // ✅ Convert to lookup map
      const countMap = new Map<string, number>();
      countResults.forEach(({ roomId, count }) => countMap.set(roomId, count));

      // ✅ Construct response format
      const result: RoomWithCount[] = rooms.map((room) => ({
        ...room,
        isMember: true,
        participationStatus: "accepted",
        memberCount: countMap.get(room.id) ?? 0,
      }));

      return successResponse({ rooms: result });
    } catch (error) {
      console.error("[Rooms Joined] Unexpected Error:", error);
      return errorResponse("Unexpected server error", "INTERNAL_ERROR", 500);
    }
  });
}

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
