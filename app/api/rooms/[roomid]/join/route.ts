import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId?: string; roomid?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const roomId = params.roomId ?? params.roomid;

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const userId = session.user.id;

    if (!roomId || !UUID_REGEX.test(roomId)) {
      return NextResponse.json({ success: false, error: "Invalid room identifier", code: "INVALID_ROOM_ID" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ success: false, error: "Room not found", code: "ROOM_NOT_FOUND" }, { status: 404 });
    }

    const { data: existingMember } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();
    if (existingMember) {
      return NextResponse.json({ success: true, status: "accepted", message: "Already a member", roomJoined: room }, { status: 200 });
    }

    const status = room.is_private ? "pending" : "accepted";
    const joined_at = !room.is_private ? new Date().toISOString() : null; // Use null instead of undefined

    await supabase.rpc("join_room", {
      p_room_id: roomId,
      p_user_id: userId,
      p_status: status,
      p_joined_at: joined_at // Pass null when private, which Supabase will handle
    });

    const notification = {
      user_id: room.is_private ? room.created_by! : userId,
      sender_id: userId,
      room_id: roomId,
      type: room.is_private ? "join_request" : "room_joined",
      message: room.is_private ? `${session.user.email} requested to join "${room.name}"` : `You joined "${room.name}"`,
      status: "unread",
      join_status: room.is_private ? "pending" : null
    };
    await supabase.from("notifications").insert(notification);

    return NextResponse.json({
      success: true,
      status,
      message: room.is_private ? "Join request sent" : "Successfully joined room",
      roomJoined: room
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}