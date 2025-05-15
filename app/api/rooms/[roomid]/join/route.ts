import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId?: string; roomid?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const roomId = params.roomId ?? params.roomid;

  console.log(`[Join Room] Request params:`, params);
  console.log(`[Join Room] Processing join request for roomId: ${roomId}`);

  try {
    // 1. Auth check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error(`[Join Room] Authentication failed for roomId: ${roomId}`);
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Validate roomId
    if (!roomId) {
      console.error(`[Join Room] Missing roomId`);
      return NextResponse.json(
        { success: false, error: "Room identifier is missing", code: "MISSING_ROOM_ID" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(roomId)) {
      console.error(`[Join Room] Invalid roomId format: ${roomId}`);
      return NextResponse.json(
        { success: false, error: "Invalid room identifier format", code: "INVALID_ROOM_ID" },
        { status: 400 }
      );
    }

    // 3. Check if room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      console.error(`[Join Room] Room not found: ${roomId}, error: ${roomError?.message}`);
      return NextResponse.json(
        { success: false, error: "Room not found", code: "ROOM_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 4. Check if already a member
    const { data: existingParticipant } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    const { data: existingMember } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (existingParticipant || existingMember) {
      console.warn(`[Join Room] User ${userId} is already part of roomId: ${roomId}`);
      return NextResponse.json(
        { success: false, error: "Already joined", code: "ALREADY_JOINED" },
        { status: 400 }
      );
    }

    // 5. Insert into both tables
    const { error: participantInsertError } = await supabase
      .from("room_participants")
      .insert({
        user_id: userId,
        room_id: roomId,
        status: "accepted"
      });

    const { error: memberInsertError } = await supabase
      .from("room_members")
      .insert({
        user_id: userId,
        room_id: roomId,
        status: "active"
      });

    if (participantInsertError || memberInsertError) {
      console.error(`[Join Room] Failed to join roomId: ${roomId}, participantError: ${participantInsertError?.message}, memberError: ${memberInsertError?.message}`);
      return NextResponse.json(
        { success: false, error: "Failed to join room", code: "JOIN_FAILED" },
        { status: 500 }
      );
    }

    // 6. Create notification
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: "room_joined",
        room_id: roomId,
        sender_id: userId,
        message: `You joined the room "${room.name}"`,
        status: "unread"
      });

    console.log(`[Join Room] User ${userId} successfully joined roomId: ${roomId}`);

    // 7. Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully joined "${room.name}"`,
      roomJoined: {
        id: room.id,
        name: room.name
      }
    });

  } catch (error) {
    console.error(`[Join Room] Unexpected error for roomId: ${roomId}`, error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Reject unsupported HTTP methods
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "PATCH" } }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "PATCH" } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "PATCH" } }
  );
}
