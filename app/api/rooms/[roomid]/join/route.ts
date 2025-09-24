// /app/api/rooms/[roomId]/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;

  try {
    const supabase = await supabaseServer();

    // ✅ FIXED: More flexible room ID validation
    if (!roomId || roomId.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid room ID" },
        { status: 400 }
      );
    }

    // ✅ Auth - FIXED: Extract userId here
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const userId = session.user.id; // ✅ ADD THIS LINE

    // ✅ Enhanced room existence check
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      console.error("Room not found:", roomId, roomError);
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // ✅ Check if user is already a member
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

    if (existingParticipant?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // ✅ Sender display name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .single();

    const senderName =
      senderProfile?.display_name ||
      senderProfile?.username ||
      session.user.email ||
      "A user";

    const now = new Date().toISOString();

    // 🔹 Handle Private Room (join request)
    if (room.is_private) {
      await supabase.from("room_participants").upsert(
        {
          room_id: roomId,
          user_id: userId,
          status: "pending",
          joined_at: now,
          active: true,
          created_at: now,
        },
        { onConflict: "room_id, user_id" }
      );

      // notify room owner
      if (room.created_by && room.created_by !== userId) {
        await supabase.from("notifications").insert({
          user_id: room.created_by,
          sender_id: userId,
          room_id: roomId,
          type: "join_request",
          message: `${senderName} requested to join "${room.name}"`,
          status: "unread",
          created_at: now,
        });
      }

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });
    }

    // 🔹 Handle Public Room (auto-join)
    await supabase.from("room_participants").upsert(
      {
        room_id: roomId,
        user_id: userId,
        status: "accepted",
        joined_at: now,
        active: true,
        created_at: now,
      },
      { onConflict: "room_id, user_id" }
    );

    await supabase.from("room_members").upsert(
      {
        room_id: roomId,
        user_id: userId,
        status: "accepted",
        joined_at: now,
        active: true,
        updated_at: now,
      },
      { onConflict: "room_id, user_id" }
    );

    // notify room owner
    if (room.created_by && room.created_by !== userId) {
      await supabase.from("notifications").insert({
        user_id: room.created_by,
        sender_id: userId,
        room_id: roomId,
        type: "user_joined",
        message: `${senderName} joined "${room.name}"`,
        status: "unread",
        created_at: now,
      });
    }

    // ✅ Count members for response
    const { count: memberCount } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "accepted");

    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Joined room successfully",
      roomJoined: room,
      memberCount: memberCount ?? 0,
    });
  } catch (err: any) {
    console.error("Join API error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}