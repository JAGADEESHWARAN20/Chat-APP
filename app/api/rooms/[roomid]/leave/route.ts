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
      .select("id, name, created_by")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ success: false, error: "Room not found", code: "ROOM_NOT_FOUND" }, { status: 404 });
    }

    const { data: member } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();
    if (!member) {
      return NextResponse.json({ success: false, error: "Not a member", code: "NOT_A_MEMBER" }, { status: 403 });
    }

    if (room.created_by === userId) {
      const { count } = await supabase
        .from("room_members")
        .select("user_id", { count: "exact" })
        .eq("room_id", roomId);
      if (count && count > 1) {
        return NextResponse.json({ success: false, error: "Creator must transfer ownership", code: "CREATOR_CANNOT_LEAVE" }, { status: 400 });
      }
      await supabase.from("rooms").delete().eq("id", roomId);
    }

    await supabase.rpc("leave_room", { p_room_id: roomId, p_user_id: userId });

    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: "room_left",
        room_id: roomId,
        sender_id: userId,
        message: `You left the room "${room.name}"`,
        status: "unread"
      });

    const { data: otherRooms } = await supabase
      .from("room_participants")
      .select("room_id, rooms(name)")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      message: `Successfully left "${room.name}"`,
      roomLeft: { id: room.id, name: room.name },
      hasOtherRooms: !!otherRooms?.length,
      defaultRoom: otherRooms?.[0] ? { id: otherRooms[0].room_id, name: otherRooms[0].rooms.name } : null
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "PATCH" } });
}
export async function POST() {
  return NextResponse.json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "PATCH" } });
}
export async function PUT() {
  return NextResponse.json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "PATCH" } });
}
export async function DELETE() {
  return NextResponse.json({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "PATCH" } });
}