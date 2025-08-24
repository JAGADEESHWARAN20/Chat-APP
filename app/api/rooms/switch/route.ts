import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { roomId } = await req.json();

  // Auth check
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user)
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Authentication required" }, { status: 401 });

  const userId = session.user.id;

  // Fetch room info
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, created_by, is_private")
    .eq("id", roomId)
    .single();

  if (roomError || !room)
    return NextResponse.json({ code: "ROOM_NOT_FOUND", error: "Room not found" }, { status: 404 });

  // --- Deactivate user in other rooms ---
  await supabase
    .from("room_members")
    .update({ active: false })
    .eq("user_id", userId);

  if (room.is_private) {
    // Check if already pending or accepted
    const { data: participant } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (participant?.status === "pending") {
      return NextResponse.json({
        status: "pending",
        message: "Join/switch request already sent."
      });
    }

    if (participant?.status === "accepted") {
      // Reactivate in room_members if exists
      await supabase
        .from("room_members")
        .upsert([{ room_id: roomId, user_id: userId, status: "accepted", active: true }], {
          onConflict: "room_id,user_id",
        });

      return NextResponse.json({
        status: "accepted",
        message: "Switched back to private room.",
      });
    }

    // Insert to room_participants as pending
    await supabase
      .from("room_participants")
      .upsert([{ room_id: roomId, user_id: userId, status: "pending" }], {
        onConflict: "room_id,user_id",
      });

    // Safety check
    if (!room.created_by) {
      return NextResponse.json({ error: "Room owner is missing", code: "ROOM_OWNER_MISSING" }, { status: 500 });
    }

    // Insert notification to owner
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
      message: "Switch request sent to room owner for approval.",
    });
  } else {
    // Public room: upsert as accepted + active
    const now = new Date().toISOString();

    await supabase
      .from("room_members")
      .upsert(
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

    await supabase
      .from("room_participants")
      .upsert(
        [
          {
            room_id: roomId,
            user_id: userId,
            status: "accepted",
            joined_at: now,
          },
        ],
        { onConflict: "room_id,user_id" }
      );

    return NextResponse.json({
      status: "accepted",
      message: "Switched to public room.",
    });
  }
}
