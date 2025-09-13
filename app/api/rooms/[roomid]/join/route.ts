// /app/api/rooms/[roomId]/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { roomId } = await params;

    if (!roomId || !UUID_REGEX.test(roomId)) {
      return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = session.user.id;

    // ✅ Fetch room
    const { data: room } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // ✅ Check existing membership/participation
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
    if (existingParticipant?.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // ✅ Sender name
    const { data: senderProfile } = await supabase
      .from("users")
      .select("display_name, username")
      .eq("id", userId)
      .single();
    const senderName =
      senderProfile?.display_name ||
      senderProfile?.username ||
      session.user.email ||
      "A user";

    const now = new Date().toISOString();

    if (room.is_private) {
      // Private room → add pending participant
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

      // Notify room owner
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
    } else {
      // Public room → add to participants & members
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

      // Notify room owner
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
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
