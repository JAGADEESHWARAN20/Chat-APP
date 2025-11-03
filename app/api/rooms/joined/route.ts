import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error("[Rooms Joined] Auth failed:", sessionError?.message);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get search query from URL
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("q")?.toLowerCase() || "";

    console.log(`[Rooms Joined] Fetching joined rooms for user: ${userId}`);

    // Get all rooms where user is an accepted member with proper room data
    const { data: memberships, error: membershipError } = await supabase
      .from("room_members")
      .select(`
        room_id,
        status,
        rooms!inner (
          id, name, is_private, created_by, created_at
        )
      `)
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (membershipError) {
      console.error("[Rooms Joined] Memberships fetch error:", membershipError.message);
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      console.log("[Rooms Joined] No joined rooms found for user");
      return NextResponse.json({ success: true, rooms: [] });
    }

    // Extract rooms from memberships
    const rooms = memberships.map(m => m.rooms);

    // Filter by search query if provided
    const filteredRooms = searchQuery 
      ? rooms.filter(room => room.name.toLowerCase().includes(searchQuery))
      : rooms;

    console.log(`[Rooms Joined] Found ${filteredRooms.length} joined rooms after filtering`);

    const roomIds = filteredRooms.map(room => room.id);

    // Fetch member counts for these rooms using count API for better performance
    const memberCountPromises = roomIds.map(async (roomId) => {
      const { count, error } = await supabase
        .from("room_members")
        .select("user_id", { count: 'exact', head: true })
        .eq("room_id", roomId)
        .eq("status", "accepted");

      if (error) {
        console.error(`[Rooms Joined] Error counting members for room ${roomId}:`, error);
        return { roomId, count: 0 };
      }

      return { roomId, count: count || 0 };
    });

    const memberCounts = await Promise.all(memberCountPromises);
    
    // Create a map of room_id to member count
    const countsMap = new Map<string, number>();
    memberCounts.forEach(({ roomId, count }) => {
      countsMap.set(roomId, count);
    });

    // Format the response with proper member counts
    const joinedRooms = filteredRooms.map((room) => {
      const memberCount = countsMap.get(room.id) || 0;
      
      console.log(`[Rooms Joined] Room ${room.name} (${room.id}): ${memberCount} members`);
      
      return {
        ...room,
        isMember: true,
        participationStatus: "accepted" as const,
        memberCount: memberCount,
      };
    });

    console.log(`[Rooms Joined] Returning ${joinedRooms.length} joined rooms with member counts`);

    return NextResponse.json({ success: true, rooms: joinedRooms });
  } catch (err) {
    console.error("[Rooms Joined] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error occurred" }, { status: 500 });
  }
}