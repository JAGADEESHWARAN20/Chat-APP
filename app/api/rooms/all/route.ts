import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: true, rooms: [] });
    }

    const userId = user.id;

    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("q")?.toLowerCase() ?? "";

    // ✅ Fetch all rooms
    let roomQuery = supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .order("created_at", { ascending: false });

    if (searchQuery.trim()) {
      roomQuery = roomQuery.ilike("name", `%${searchQuery}%`);
    }

    const { data: rooms, error: roomsError } = await roomQuery;
    if (roomsError) throw roomsError;

    if (!rooms?.length) return NextResponse.json({ success: true, rooms: [] });

    const roomIds = rooms.map((r) => r.id);

    // ✅ Get user membership statuses (accepted or pending)
    const { data: membershipList } = await supabase
      .from("room_members")
      .select("room_id, status")
      .in("room_id", roomIds)
      .eq("user_id", userId);

    const membershipMap = new Map(
      membershipList?.map((m) => [m.room_id, m.status]) ?? []
    );

    // ✅ Count members for each room
    const { data: memberCountList } = await supabase
      .from("room_members")
      .select("room_id, status")
      .in("room_id", roomIds)
      .eq("status", "accepted");

    const memberCountMap = new Map<string, number>();
    memberCountList?.forEach((m) =>
      memberCountMap.set(m.room_id, (memberCountMap.get(m.room_id) ?? 0) + 1)
    );

    // ✅ Format response
    const formatted = rooms.map((room) => {
      const status = membershipMap.get(room.id) ?? null;

      // 🔐 Hide private rooms unless user is involved
      if (room.is_private && !status) return null;

      return {
        ...room,
        isMember: status === "accepted",
        participationStatus: status,
        memberCount: memberCountMap.get(room.id) ?? 0,
      };
    }).filter(Boolean);

    return NextResponse.json({ success: true, rooms: formatted });
  } catch (error) {
    console.error("[Rooms All] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
