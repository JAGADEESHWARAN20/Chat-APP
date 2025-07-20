import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

// POST /api/rooms/[roomId]/switch
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const roomId = params.roomId;

  // 1. Auth check
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  // 2. Fetch room info
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, is_private, name, created_by")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json(
      { error: "Room not found" },
      { status: 404 }
    );
  }

  // 3. Check if already a member/participant
  const { data: member } = await supabase
    .from("room_members")
    .select("status")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.status === "accepted" && !room.is_private) {
    return NextResponse.json({
      message: "Already a member",
      status: "accepted"
    });
  }

  // 4. Join/Switch logic
  if (!room.is_private) {
    // PUBLIC: upsert as member and participant (accepted)
    const now = new Date().toISOString();
    await supabase
      .from("room_members")
      .upsert([{ room_id: roomId, user_id: userId, status: "accepted", joined_at: now, active: true }], { onConflict: "room_id,user_id" });

    await supabase
      .from("room_participants")
      .upsert([{ room_id: roomId, user_id: userId, status: "accepted", joined_at: now }], { onConflict: "room_id,user_id" });

    return NextResponse.json({ status: "accepted", message: "Switched to public room" });
  } else {
    // PRIVATE: upsert to participants as pending; notify owner only if not already pending
    const { data: existingParticipant } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingParticipant?.status === "pending") {
      return NextResponse.json({
        status: "pending",
        message: "Switch request already sent, waiting for approval.",
      });
    }

    await supabase
      .from("room_participants")
      .upsert([{ room_id: roomId, user_id: userId, status: "pending" }], { onConflict: "room_id,user_id" });

    // Safety: Ensure owner exists
    if (!room.created_by) {
      return NextResponse.json({
        error: "Room owner missing in DB.",
        code: "ROOM_OWNER_MISSING"
      }, { status: 500 });
    }

    await supabase.from("notifications").insert({
      user_id: room.created_by,
      sender_id: userId,
      room_id: roomId,
      type: "join_request",
      message: `${session.user.email} wants to join "${room.name}"`,
      status: "unread",
    });

    return NextResponse.json({
      status: "pending",
      message: "Switch request sent to room owner for approval."
    });
  }
}
