import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, isPrivate } = await req.json();

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Room name is required" }, { status: 400 });
  }

  const roomName = name.trim();
  const userId = session.user.id;

  try {
    // Transaction: Create room, add creator to room_members and room_participants (if private)
    const transaction = async () => {
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({ name: roomName, created_by: userId, is_private: isPrivate })
        .select()
        .single();
      if (roomError) {
        throw new Error(`Failed to create room: ${roomError.message}`);
      }

      // Add creator to room_members
      const { error: memberError } = await supabase
        .from("room_members")
        .insert({ room_id: room.id, user_id: userId, status: "accepted", active: true });
      if (memberError) {
        throw new Error(`Failed to add creator to room_members: ${memberError.message}`);
      }

      // If private, add creator to room_participants
      if (isPrivate) {
        const { error: participantError } = await supabase
          .from("room_participants")
          .insert({ room_id: room.id, user_id: userId, status: "accepted", joined_at: new Date().toISOString() });
        if (participantError) {
          throw new Error(`Failed to add creator to room_participants: ${participantError.message}`);
        }
      }

      return room;
    };

    const room = await transaction();
    return NextResponse.json(room);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}