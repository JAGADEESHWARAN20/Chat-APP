import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from "@/lib/types/supabase";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  // 1) init supabase + auth check
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;
  const roomId = params.roomId;
  console.log("Joining room:", roomId);

  // 2) fetch room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("created_by, name, is_private")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    console.error("Room fetch error:", roomError);
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // 3) insert into room_participants
  const status = room.is_private ? "pending" : "accepted";
  const joined_at = room.is_private ? undefined : new Date().toISOString();

  const { error: partError } = await supabase
    .from("room_participants")
    .insert({
      room_id: roomId,
      user_id: user.id,
      status,
      joined_at,
    });

  if (partError) {
    console.error("room_participants insert error:", partError);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }

  // 4) if public, upsert into room_members
  if (!room.is_private) {
    const { error: memberError } = await supabase
      .from("room_members")
      .upsert({
        room_id: roomId,
        user_id: user.id,
        active: true,
        joined_at,
        status,
      });

    if (memberError) {
      console.error("room_members upsert error:", memberError);
      // we won’t block the request on this, but you can fail if you prefer
    }
  }

  // 5) send a notification
  //    - private: to room.created_by
  //    - public: to the joining user themself
  const recipientId = room.is_private ? room.created_by! : user.id;
  const type = room.is_private ? "join_request" : "room_switch";
  const message = room.is_private
    ? `${user.email} requested to join "${room.name}"`
    : `You joined "${room.name}"`;

  const { error: notifError } = await supabase
    .from("notifications")
    .insert({
      user_id: recipientId,
      sender_id: user.id,
      room_id: roomId,
      type,
      message,
      status: "unread",
    });

  if (notifError) {
    console.error("notifications insert error:", notifError);
  }

  return NextResponse.json({
    success: true,
    status,
    message: room.is_private
      ? "Join request sent"
      : "Joined room successfully",
  });
}
