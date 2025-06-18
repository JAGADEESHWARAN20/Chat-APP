import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error("[Rooms All] Authentication failed", sessionError);
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .order("created_at", { ascending: false });
    
    if (roomsError) {
      console.error("[Rooms All] Error fetching rooms:", roomsError);
      return NextResponse.json(
        { error: "Failed to fetch rooms" },
        { status: 500 }
      );
    }

    // Batch check membership for all rooms
    const roomIds = rooms.map((room) => room.id);
    const { data: memberships, error: membershipError } = await supabase
      .from("room_participants") // or "room_members"
      .select("room_id, status")
      .in("room_id", roomIds)
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (membershipError) {
      console.error("[Rooms All] Error fetching memberships:", membershipError);
      return NextResponse.json(
        { error: "Failed to fetch memberships" },
        { status: 500 }
      );
    }

    // Create a membership map
    const membershipMap: { [key: string]: boolean } = {};
    roomIds.forEach((roomId) => {
      membershipMap[roomId] = false;
    });
    memberships.forEach((membership) => {
      if (membership.status === "accepted") {
        membershipMap[membership.room_id] = true;
      }
    });

    // Add isMember to each room
    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      isMember: membershipMap[room.id] || false,
    }));

    return NextResponse.json({
      success: true,
      rooms: roomsWithMembership,
    });
  } catch (error) {
    console.error("[Rooms All] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}