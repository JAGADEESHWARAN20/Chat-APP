import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Add this line to force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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
            } catch {
              // Ignore if called from Server Component
            }
          },
        },
      }
    );
    

    // Get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error("[Rooms All] Auth failed:", sessionError?.message);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get search query from URL
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("q")?.toLowerCase() || "";

    // Fetch all rooms (filter by name if query present)
    let query = supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .order("created_at", { ascending: false });

    if (searchQuery) {
      query = query.ilike("name", `%${searchQuery}%`);
    }

    const { data: rooms, error: roomsError } = await query;

    if (roomsError) {
      console.error("[Rooms All] Rooms fetch error:", roomsError.message);
      return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
    }

    if (!rooms || rooms.length === 0) {
      return NextResponse.json({ success: true, rooms: [] });
    }

    const roomIds = rooms.map((room) => room.id);

    // Fetch memberships where user is accepted
    const { data: memberships, error: membershipError } = await supabase
      .from("room_members")
      .select("room_id")
      .in("room_id", roomIds)
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (membershipError) {
      console.error("[Rooms All] Membership fetch error:", membershipError.message);
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
    }

    const joinedRoomIds = new Set(memberships?.map((m) => m.room_id));

    // Fetch all accepted members for rooms to count them client-side
    const { data: membersData, error: membersError } = await supabase
      .from("room_members")
      .select("room_id")
      .in("room_id", roomIds)
      .eq("status", "accepted");

    if (membersError) {
      console.error("[Rooms All] Member counts fetch error:", membersError.message);
      // Optionally you can continue with zero counts here
    }

    // Calculate member counts
    const countsMap = new Map<string, number>();
    membersData?.forEach((m) => {
      countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
    });

    // Attach membership flag and member count to each room
    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      isMember: joinedRoomIds.has(room.id),
      memberCount: countsMap.get(room.id) ?? 0,
    }));

    return NextResponse.json({ success: true, rooms: roomsWithMembership });
  } catch (err) {
    console.error("[Rooms All] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error occurred" }, { status: 500 });
  }
}
