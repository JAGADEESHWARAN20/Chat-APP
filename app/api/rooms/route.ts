// /app/api/rooms/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, is_private } = await req.json();

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Room name is required" }, { status: 400 });
  }

  const roomName = name.trim();
  const userId = session.user.id;

  try {
    // Insert the new room
    const { data, error: roomError } = await supabase
      .from("rooms")
      .insert({ name: roomName, created_by: userId, is_private: !!is_private })
      .select()
      .single();

    if (roomError) {
      console.error("Error creating room:", roomError);
      return NextResponse.json({ error: "Failed to create room", details: roomError.message }, { status: 500 });
    }

    // Add creator as an accepted participant
    const { error: participantError } = await supabase
      .from("room_participants")
      .insert({
        room_id: data.id,
        user_id: userId,
        status: "accepted",
        joined_at: new Date().toISOString(),
      });

    if (participantError) {
      console.error("Error adding participant:", participantError);
      // Optionally rollback room creation if participant fails (requires transaction)
      return NextResponse.json({ error: "Failed to add room participant", details: participantError.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error", details: (err as Error).message }, { status: 500 });
  }
}

// GET handler remains unchanged
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }

  return NextResponse.json(data || []);
}