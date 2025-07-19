import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const query = req.nextUrl.searchParams.get("query")?.trim() || "";
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "10"), 1), 50);
  const offset = Math.max(parseInt(req.nextUrl.searchParams.get("offset") || "0"), 0);

  try {
    const { data: memberRooms, error: memberError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (memberError) {
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
    }

    const memberRoomIds = memberRooms.map((m) => m.room_id);
    const memberRoomIdsString =
      memberRoomIds.length > 0 ? memberRoomIds.map((id) => `"${id}"`).join(",") : '"-"';

    const accessibilityFilter = `is_private.eq.false,id.in.(${memberRoomIdsString})`;

    let supabaseQuery = supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (query) {
      supabaseQuery = supabaseQuery
        .ilike("name", `%${query}%`)
        .or(accessibilityFilter, { foreignTable: undefined });
    } else {
      supabaseQuery = supabaseQuery
        .or(accessibilityFilter, { foreignTable: undefined });
    }

    const { data: rooms, error: roomsError, count } = await supabaseQuery;

    if (roomsError) {
      return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
    }

    const roomIds = rooms.map((room) => room.id);
    const { data: memberships } = await supabase
      .from("room_members")
      .select("room_id")
      .in("room_id", roomIds)
      .eq("user_id", userId)
      .eq("status", "accepted");

    const membershipSet = new Set(memberships?.map((m) => m.room_id));
    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      isMember: membershipSet.has(room.id),
    }));

    return NextResponse.json({
      rooms: roomsWithMembership,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[Rooms Search] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
