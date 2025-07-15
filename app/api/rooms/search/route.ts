import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  console.log("[Rooms Search] Checking authentication");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error("[Rooms Search] Unauthorized access");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[Rooms Search] Authentication successful, userId:", session.user.id);

  const userId = session.user.id;

  const query = req.nextUrl.searchParams.get("query");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10", 10);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);

  console.log("[Rooms Search] Validating query parameters:", { query, limit, offset });
  if (isNaN(limit) || limit < 1 || limit > 50) {
    console.error("[Rooms Search] Invalid limit parameter");
    return NextResponse.json({ error: "Invalid limit parameter (must be 1-50)" }, { status: 400 });
  }
  if (isNaN(offset) || offset < 0) {
    console.error("[Rooms Search] Invalid offset parameter");
    return NextResponse.json({ error: "Invalid offset parameter (must be non-negative)" }, { status: 400 });
  }

  try {
    let supabaseQuery = supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // If no query, fetch all accessible rooms (public or user is a member)
    if (!query || query.trim() === "") {
      console.log("[Rooms Search] Fetching all accessible rooms");
      const { data: memberRooms, error: memberError } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", userId)
        .eq("status", "accepted");

      if (memberError) {
        console.error("[Rooms Search] Error fetching memberships:", memberError);
        return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
      }

      const memberRoomIds = memberRooms.map((m) => m.room_id);
      supabaseQuery = supabase
        .from("rooms")
        .select("id, name, is_private, created_by, created_at", { count: "exact" })
        .or(`is_private.eq.false, id.in.(${memberRoomIds.join(",")})`)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
    } else {
      console.log("[Rooms Search] Fetching rooms with query:", query.trim());
      supabaseQuery = supabaseQuery.ilike("name", `%${query.trim()}%`);
    }

    const { data: rooms, error: roomsError, count } = await supabaseQuery;

    if (roomsError) {
      console.error("[Rooms Search] Supabase Query Error:", roomsError);
      return NextResponse.json({ error: "Failed to search rooms" }, { status: 500 });
    }
    console.log("[Rooms Search] Rooms fetched successfully:", { count, rooms });

    const roomIds = rooms.map((room) => room.id);
    const { data: memberships, error: membershipError } = await supabase
      .from("room_members")
      .select("room_id, status")
      .in("room_id", roomIds)
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (membershipError) {
      console.error("[Rooms Search] Error fetching memberships:", membershipError);
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
    }
    console.log("[Rooms Search] Memberships fetched:", memberships);

    const membershipMap: { [key: string]: boolean } = {};
    roomIds.forEach((roomId) => {
      membershipMap[roomId] = false;
    });
    memberships.forEach((membership) => {
      if (membership.status === "accepted") {
        membershipMap[membership.room_id] = true;
      }
    });
    console.log("[Rooms Search] Membership map created:", membershipMap);

    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      isMember: membershipMap[room.id] || false,
    }));

    console.log("[Rooms Search] Search Results:", { rooms: roomsWithMembership, total: count });

    return NextResponse.json({
      rooms: roomsWithMembership || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[Rooms Search] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}