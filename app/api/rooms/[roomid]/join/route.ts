// api/rooms/[roomId]/join/route.ts
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

  // 5. Determine join status and joined_at value
  const isPrivate = room.is_private;
  const joinStatus = isPrivate ? "pending" : "accepted";

  // Use null for p_joined_at if pending, otherwise use ISO string
  const pJoinedAtValue: string | null = isPrivate ? null : new Date().toISOString();

  // 6. Insert membership (via RPC)
  // Ensure your 'join_room' RPC can handle p_joined_at being NULL.
  const { error: joinError } = await supabase.rpc("join_room", {
    p_room_id: room.id,
    p_user_id: userId,
    p_status: joinStatus,
    p_joined_at: pJoinedAtValue, // Use null for pending, actual timestamp for accepted
  });

  if (joinError) {
    console.error("Join RPC error:", joinError);
    // Add specific error handling for unique constraint violation if user already exists
    if (joinError.code === "23505") { // Example unique constraint error code
        return NextResponse.json(
            { success: false, error: "You are already a member or have a pending request for this room.", code: "ALREADY_MEMBER_OR_PENDING" },
            { status: 409 }
        );
    }
    return NextResponse.json(
      { success: false, error: "Failed to join room", code: "JOIN_FAILED", details: joinError.message },
      { status: 500 }
    );
  }

  // 7. Create notification
  const notificationMessage = isPrivate
    ? `${session.user.email} requested to join "${room.name}"`
    : `You joined "${room.name}"`;

  const notification = {
    user_id: isPrivate ? room.created_by! : userId, // Recipient: owner for private, self for public
    sender_id: userId, // Sender: always the current user
    room_id: room.id,
    type: isPrivate ? "join_request" : "room_joined",
    message: notificationMessage,
    status: "unread",
    join_status: isPrivate ? "pending" : null, // Set join_status only for private room requests
  };

  const { error: notifError } = await supabase
    .from("notifications")
    .insert(notification);

  if (notifError) {
    console.warn("Notification error (non-blocking, but log for debugging):", notifError.message);
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
