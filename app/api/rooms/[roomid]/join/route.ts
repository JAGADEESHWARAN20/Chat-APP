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
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
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

  // 4. Check if already a member or participant
  const { data: existingMember } = await supabase
    .from("room_members")
    .select("status")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: existingParticipant } = await supabase
    .from("room_participants")
    .select("status")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember?.status === "accepted" || existingParticipant?.status === "accepted") {
    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Already a member",
      roomJoined: room,
    });
  }

  if (existingParticipant?.status === "pending" || existingMember?.status === "pending") {
    return NextResponse.json({
      success: true,
      status: "pending",
      message: "Join request already sent",
    });
  }

  // 5. Insert/Update participant/member, notify owner if private
  const isPrivate = room.is_private;

  if (isPrivate) {
    // Safety: owner must exist for private room
    if (!room.created_by) {
      return NextResponse.json({
        success: false,
        error: "Room owner information is missing.",
        code: "ROOM_OWNER_MISSING"
      }, { status: 500 });
    }

    // Insert participant as pending
    const { error: pErr } = await supabase
      .from("room_participants")
      .upsert([{ room_id: roomId, user_id: userId, status: "pending" }], { onConflict: "room_id,user_id" });
    if (pErr) {
      return NextResponse.json({ success: false, error: "Could not request join", details: pErr.message }, { status: 500 });
    }

    // Create join_request notification for owner
    const notifInsert = {
      user_id: room.created_by,      // definitely a string here
      sender_id: userId,
      room_id: roomId,
      type: "join_request",
      message: `${session.user.email} requested to join "${room.name}"`,
      status: "unread",
    };
    const { error: notifError } = await supabase.from("notifications").insert(notifInsert);
    if (notifError) {
      // Non-blocking
      console.warn("Notification error:", notifError.message);
    }
    return NextResponse.json({
      success: true,
      status: "pending",
      message: "Join request sent to room owner",
    });
  } else {
    // Public room: upsert accepted to both tables
    const now = new Date().toISOString();
    const { error: partErr } = await supabase
      .from("room_participants")
      .upsert([{ room_id: roomId, user_id: userId, status: "accepted", joined_at: now }], { onConflict: "room_id,user_id" });
    const { error: memberErr } = await supabase
      .from("room_members")
      .upsert([{ room_id: roomId, user_id: userId, status: "accepted", joined_at: now, active: true }], { onConflict: "room_id,user_id" });

    if (memberErr || partErr) {
      return NextResponse.json(
        { success: false, error: "Join failed", details: memberErr?.message || partErr?.message }, { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Joined room",
      roomJoined: room,
    });
  }
}
