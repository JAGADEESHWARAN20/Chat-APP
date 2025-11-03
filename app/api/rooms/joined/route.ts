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

    // First, get all rooms where user is an accepted member
    const { data: memberships, error: membershipError } = await supabase
      .from("room_members")
      .select(`
        room_id,
        status,
        rooms:room_id (
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
      return NextResponse.json({ success: true, rooms: [] });
    }

    // Extract rooms from memberships
    const rooms = memberships
      .map(m => m.rooms)
      .filter(Boolean) as Database["public"]["Tables"]["rooms"]["Row"][];

    // Filter by search query if provided
    const filteredRooms = searchQuery 
      ? rooms.filter(room => room.name.toLowerCase().includes(searchQuery))
      : rooms;

    const roomIds = filteredRooms.map(room => room.id);

    // Fetch member counts for these rooms
    const { data: membersData, error: membersError } = await supabase
      .from("room_members")
      .select("room_id")
      .in("room_id", roomIds)
      .eq("status", "accepted");

    // Calculate member counts
    const countsMap = new Map<string, number>();
    membersData?.forEach((m) => {
      countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
    });

    // Format the response
    const joinedRooms = filteredRooms.map((room) => ({
      ...room,
      isMember: true,
      participationStatus: "accepted" as const,
      memberCount: countsMap.get(room.id) ?? 0,
    }));

    console.log(`[Rooms Joined] Returning ${joinedRooms.length} joined rooms for user ${userId}`);

    return NextResponse.json({ success: true, rooms: joinedRooms });
  } catch (err) {
    console.error("[Rooms Joined] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error occurred" }, { status: 500 });
  }
}