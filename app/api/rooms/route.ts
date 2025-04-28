import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get request body
    const body = await req.json();
    const { name, is_private } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 }
      );
    }

    // Check if room name already exists
    const { data: existingRoom } = await supabase
      .from("rooms")
      .select("id")
      .ilike("name", name.trim())
      .single();

    if (existingRoom) {
      return NextResponse.json(
        { error: "A room with this name already exists" },
        { status: 400 }
      );
    }

    // Create new room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert([
        {
          name: name.trim(),
          created_by: session.user.id,
          is_private: is_private || false,
        },
      ])
      .select()
      .single();

    if (roomError) {
      console.error("Error creating room:", roomError);
      return NextResponse.json(
        { error: "Failed to create room" },
        { status: 500 }
      );
    }

    // Add creator as room member and participant
    const { error: memberError } = await supabase.from("room_members").insert([
      {
        room_id: room.id,
        user_id: session.user.id,
        active: false,
      },
    ]);

    const { error: participantError } = await supabase.from("room_participants").insert([
      {
        room_id: room.id,
        user_id: session.user.id,
        status: "accepted",
        joined_at: new Date().toISOString(),
      },
    ]);

    if (memberError || participantError) {
      console.error("Error adding creator to room:", { memberError, participantError });
    }

    return NextResponse.json({
      success: true,
      room,
    });

  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
