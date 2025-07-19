import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const roomId = params.roomId;

  // 1. Session check
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    return NextResponse.json(
      { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // 2. Room ID validation
  if (!roomId || !UUID_REGEX.test(roomId)) {
    return NextResponse.json(
      { success: false, error: "Invalid room ID", code: "INVALID_ROOM_ID" },
      { status: 400 }
    );
  }

  // 3. Fetch room info
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, created_by, is_private")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json(
      { success: false, error: "Room not found", code: "ROOM_NOT_FOUND" },
      { status: 404 }
    );
  }

  // 4. Check if already a member
  const { data: existingMember } = await supabase
    .from("room_members")
    .select("status")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember?.status === "accepted") {
    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Already a member",
      roomJoined: room,
    });
  }

  if (existingMember?.status === "pending") {
    return NextResponse.json({
      success: true,
      status: "pending",
      message: "Join request already sent",
    });
  }

  // 5. Determine join status and joinedAt value
  const isPrivate = room.is_private;
  const joinStatus = isPrivate ? "pending" : "accepted";
  
  // Convert null to undefined if room is private, otherwise use ISO string
  const joinedAtValue: string | undefined = isPrivate ? undefined : new Date().toISOString();

  // 6. Insert membership (via RPC or directly)
  const { error: joinError } = await supabase.rpc("join_room", {
    p_room_id: room.id,
    p_user_id: userId,
    p_status: joinStatus,
    p_joined_at: joinedAtValue, // Use the converted value here
  });

  if (joinError) {
    console.error("Join RPC error:", joinError);
    return NextResponse.json(
      { success: false, error: "Failed to join room", code: "JOIN_FAILED" },
      { status: 500 }
    );
  }

  // 7. Create notification
  const notification = {
    user_id: isPrivate ? room.created_by! : userId,
    sender_id: userId,
    room_id: room.id,
    type: isPrivate ? "join_request" : "room_joined",
    message: isPrivate
      ? `${session.user.email} requested to join "${room.name}"`
      : `You joined "${room.name}"`,
    status: "unread",
    join_status: isPrivate ? "pending" : null,
  };

  const { error: notifError } = await supabase
    .from("notifications")
    .insert(notification);

  if (notifError) {
    console.warn("Notification error (non-blocking):", notifError.message);
  }

  return NextResponse.json({
    success: true,
    status: joinStatus,
    message: isPrivate
      ? "Join request sent to room owner"
      : "Successfully joined room",
    roomJoined: room,
  });
}