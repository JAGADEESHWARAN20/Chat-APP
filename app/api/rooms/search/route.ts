import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function GET(req: NextRequest) {
  // Initialize Supabase client using cookies for authentication
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // Get the current session to authenticate the user
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // If no session, return unauthorized error
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id; // Get the ID of the authenticated user
  // Extract query parameters for search, limit, and offset
  const query = req.nextUrl.searchParams.get("query")?.trim() || "";
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "10"), 1), 50);
  const offset = Math.max(parseInt(req.nextUrl.searchParams.get("offset") || "0"), 0);

  try {
    // 1. Fetch all rooms from the 'rooms' table
    // The previous logic for filtering by 'accepted' status or 'is_private' is removed
    // to retrieve all rooms initially.
    let supabaseQuery = supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at", { count: "exact" }) // Select relevant room fields
      .order("created_at", { ascending: false }) // Order rooms by creation date
      .range(offset, offset + limit - 1); // Apply pagination

    // If a search query is provided, filter rooms by name
    if (query) {
      supabaseQuery = supabaseQuery.ilike("name", `%${query}%`);
    }

    // Execute the query to get rooms and their total count
    const { data: rooms, error: roomsError, count } = await supabaseQuery;

    if (roomsError) {
      // Handle error if fetching rooms fails
      console.error("[Rooms Search] Failed to fetch rooms:", roomsError);
      return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
    }

    // Extract room IDs from the fetched rooms
    const roomIds = rooms.map((room) => room.id);

    // 2. Check user's membership status in 'room_members' table for the fetched rooms
    const { data: acceptedMemberships, error: membersError } = await supabase
      .from("room_members")
      .select("room_id") // Select only room_id
      .in("room_id", roomIds) // Filter by the room IDs we just fetched
      .eq("user_id", userId) // Filter by the current user's ID
      .eq("status", "accepted"); // Only consider 'accepted' memberships

    if (membersError) {
      console.error("[Rooms Search] Error fetching room memberships:", membersError);
      // Continue processing even if there's an error fetching memberships,
      // as it might just mean the user isn't a member of any.
    }

    // 3. Check user's participation status in 'room_participants' table for the fetched rooms
    const { data: acceptedParticipants, error: participantsError } = await supabase
      .from("room_participants")
      .select("room_id") // Select only room_id
      .in("room_id", roomIds) // Filter by the room IDs we just fetched
      .eq("user_id", userId) // Filter by the current user's ID
      .eq("status", "accepted"); // Only consider 'accepted' participations

    if (participantsError) {
      console.error("[Rooms Search] Error fetching room participants:", participantsError);
      // Continue processing even if there's an error fetching participants.
    }

    // Combine accepted room IDs from both room_members and room_participants
    const userAcceptedRoomIds = new Set<string>();
    acceptedMemberships?.forEach((m) => userAcceptedRoomIds.add(m.room_id));
    acceptedParticipants?.forEach((p) => userAcceptedRoomIds.add(p.room_id));

    // 4. Map through rooms and add 'isMember' flag
    const roomsWithMembership = rooms.map((room) => ({
      ...room,
      // 'isMember' is true if the user's ID is found in the combined set of accepted room IDs
      isMember: userAcceptedRoomIds.has(room.id),
    }));

    // Return the paginated list of rooms with their membership status
    return NextResponse.json({
      rooms: roomsWithMembership,
      total: count || 0, // Total count of rooms matching the query
      limit,
      offset,
    });
  } catch (err) {
    // Catch any unexpected errors during the process
    console.error("[Rooms Search] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
