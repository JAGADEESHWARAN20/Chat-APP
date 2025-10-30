import { supabaseServer } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Simple UUID validation regex (matches the one in frontend)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = await supabaseServer();
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const roomId = params.roomId;

    // ✅ FIX: Early validation for roomId to prevent DB errors
    if (!roomId || roomId === 'undefined' || !UUID_REGEX.test(roomId)) {
      console.warn("🚫 Invalid roomId in join request:", { userId, userEmail: session.user.email, roomId });
      return NextResponse.json(
        { error: 'Invalid or missing room ID' },
        { status: 400 }
      );
    }

    console.log("🚀 Join room API called by user:", {
      userId,
      userEmail: session.user.email,
      roomId
    });

    // Room existence check - use maybeSingle to handle 406 gracefully
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) {
      console.error("Room database error:", roomError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check existing membership with array queries
    const [membersResult, participantsResult] = await Promise.all([
      supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId),
      supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
    ]);

    const existingMember = membersResult.data?.[0];
    const existingParticipant = participantsResult.data?.[0];

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

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();

    const senderName = senderProfile?.display_name || senderProfile?.username || session.user.email || "A user";
    const now = new Date().toISOString();

    // Handle Private Room
    if (room.is_private) {
      const { error: upsertError } = await supabase.from("room_participants").upsert(
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

      if (upsertError) {
        console.error("Private room upsert error:", upsertError);
        return NextResponse.json({ error: "Failed to send join request" }, { status: 500 });
      }

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
    }

    // Handle Public Room
    const [participantResult, memberResult] = await Promise.all([
      supabase.from("room_participants").upsert(
        {
          room_id: roomId,
          user_id: userId,
          status: "accepted",
          joined_at: now,
          active: true,
          created_at: now,
        },
        { onConflict: "room_id, user_id" }
      ),
      supabase.from("room_members").upsert(
        {
          room_id: roomId,
          user_id: userId,
          status: "accepted",
          joined_at: now,
          active: true,
          updated_at: now,
        },
        { onConflict: "room_id, user_id" }
      )
    ]);

    if (participantResult.error || memberResult.error) {
      console.error("Public room upsert errors:", {
        participant: participantResult.error,
        member: memberResult.error
      });
      return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
    }

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

    // Count members
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
    console.error("💥 JOIN API UNEXPECTED ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}