import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const roomId = params.roomId;

  // 1️⃣ Verify session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  // 2️⃣ Validate room ID
  if (!roomId || !UUID_REGEX.test(roomId)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid room ID",
        code: "INVALID_ROOM_ID",
      },
      { status: 400 }
    );
  }

  // 3️⃣ Fetch room details
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, created_by, is_private")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json(
      {
        success: false,
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  // 4️⃣ Check membership/participation
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

  if (
    existingMember?.status === "accepted" ||
    existingParticipant?.status === "accepted"
  ) {
    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Already a member",
      roomJoined: room,
    });
  }

  if (
    existingMember?.status === "pending" ||
    existingParticipant?.status === "pending"
  ) {
    return NextResponse.json({
      success: true,
      status: "pending",
      message: "Join request already sent",
    });
  }

  // 5️⃣ Private vs Public
  const isPrivate = room.is_private;

  if (isPrivate) {
    // ----- Private room → request approval -----
    if (!room.created_by) {
      return NextResponse.json(
        {
          success: false,
          error: "Room owner information is missing.",
          code: "ROOM_OWNER_MISSING",
        },
        { status: 500 }
      );
    }

    const { error: pErr } = await supabase.from("room_participants").upsert(
      [{ room_id: roomId, user_id: userId, status: "pending" }],
      { onConflict: "room_id,user_id" }
    );

    if (pErr) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not request join",
          details: pErr.message,
        },
        { status: 500 }
      );
    }

    // 🔔 Notify owner
    const notifPayload = {
      user_id: room.created_by,
      sender_id: userId,
      room_id: roomId,
      type: "join_request",
      message: `${session.user.email} requested to join "${room.name}"`,
      status: "unread",
    };

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notifPayload);

    if (notifError) {
      console.warn("[join] Notification insert error:", notifError.message);
    }
    if (room.created_by) {
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: room.created_by,
      sender_id: userId,
      room_id: roomId,
      type: "join_request",
      message: `${session.user.email} requested to join "${room.name}"`,
      status: "unread",
    });

    if (notifError) {
      console.warn("[join] Notification insert error:", notifError.message);
    }
  }


    return NextResponse.json({
      success: true,
      status: "pending",
      message: "Join request sent to room owner",
    });
  } else {
    // ----- Public room → auto-accept -----
    const now = new Date().toISOString();

    const { error: partErr } = await supabase.from("room_participants").upsert(
      [{ room_id: roomId, user_id: userId, status: "accepted", joined_at: now }],
      { onConflict: "room_id,user_id" }
    );

    const { error: memberErr } = await supabase.from("room_members").upsert(
      [
        {
          room_id: roomId,
          user_id: userId,
          status: "accepted",
          joined_at: now,
          active: true,
        },
      ],
      { onConflict: "room_id,user_id" }
    );

    if (partErr || memberErr) {
      return NextResponse.json(
        {
          success: false,
          error: "Join failed",
          details: memberErr?.message || partErr?.message,
        },
        { status: 500 }
      );
    }
    if (room.created_by) {
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: room.created_by,
      sender_id: userId,
      room_id: roomId,
      type: "user_joined",
      message: `${session.user.email} joined "${room.name}"`,
      status: "unread",
    });

    if (notifError) {
      console.warn("[join] Notification insert error:", notifError.message);
    }
  }

    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Joined room",
      roomJoined: room,
    });
  }
}
