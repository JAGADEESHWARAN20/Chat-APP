import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase"; // Use your typed DB

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

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

    // Fetch all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .order("created_at", { ascending: false });

    if (roomsError) {
      console.error("[Rooms All] Rooms fetch error:", roomsError.message);
      return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
    }

    if (!rooms || rooms.length === 0) {
      return NextResponse.json({ success: true, rooms: [] });
    }

    const roomIds = rooms.map((room) => room.id);

    // Fetch memberships
    const { data: memberships, error: membershipError } = await supabase
      .from("room_members")
      .select("room_id, status")
      .in("room_id", roomIds)
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (membershipError) {
      console.error("[Rooms All] Membership fetch error:", membershipError.message);
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
    }

    // Map memberships to room ids
    const membershipMap = new Map<string, boolean>();
    roomIds.forEach((id) => membershipMap.set(id, false));
    memberships?.forEach((m) => membershipMap.set(m.room_id, true));

    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      isMember: membershipMap.get(room.id) || false,
    }));

    return NextResponse.json({ success: true, rooms: roomsWithMembership });
  } catch (err) {
    console.error("[Rooms All] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error occurred" }, { status: 500 });
  }
}
