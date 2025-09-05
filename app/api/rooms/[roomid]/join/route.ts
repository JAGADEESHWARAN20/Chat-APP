// /app/api/rooms/[roomId]/join/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomid: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { roomid: roomId } = params;

    console.log("[join] Params received:", params);
    console.log("[join] Room ID extracted:", roomId);

    // 1. Validate room ID
    if (!roomId || !UUID_REGEX.test(roomId)) {
      console.error("[join] Invalid room ID:", roomId);
      return NextResponse.json(
        { success: false, error: "Invalid room ID", code: "INVALID_ROOM_ID" },
        { status: 400 }
      );
    }

    // 2. Verify session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error(
        "[join] Authentication error:",
        sessionError?.message || "No session"
      );
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log("[join] Authenticated user:", userId);

    // 3. Fetch room details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      console.error(
        "[join] Room fetch error:",
        roomError?.message || "Room not found"
      );
      return NextResponse.json(
        { success: false, error: "Room not found", code: "ROOM_NOT_FOUND" },
        { status: 404 }
      );
    }
    console.log("[join] Room details:", room);

    // 4. Check existing membership
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
      console.log("[join] User already a member:", roomId);
      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Already a member",
        roomJoined: room,
      });
    }

    if (existingParticipant?.status === "pending") {
      console.log("[join] Join request already pending:", roomId);
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // 5. Get sender profile
    const { data: senderProfile } = await supabase
      .from("users")
      .select("display_name, username")
      .eq("id", userId)
      .single();

    const senderName = senderProfile?.display_name || senderProfile?.username || session.user.email || "A user";

    const now = new Date().toISOString();
    const isPrivate = room.is_private;

    // 6. Handle public vs private room logic
    if (isPrivate) {
      // Private room: Add to participants with pending status
      const { error: insertError } = await supabase
        .from("room_participants")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "pending",
            joined_at: now,
            active: true,
            created_at: now,
          },
          {
            onConflict: "room_id, user_id",
          }
        );

      if (insertError) {
        console.error("[join] room_participants insert error:", insertError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to send join request",
            code: "JOIN_REQUEST_FAILED",
            details: insertError.message,
          },
          { status: 400 }
        );
      }

      // Notify room owner about join request (using valid 'join_request' type)
      if (room.created_by && room.created_by !== userId) {
        await supabase.from("notifications").insert({
          user_id: room.created_by,
          sender_id: userId,
          room_id: roomId,
          type: "join_request", // VALID type from constraint
          message: `${senderName} requested to join "${room.name}"`,
          status: "unread",
          created_at: now,
        });
      }

      // Notify user that request was sent (using valid 'notification_unread' type)
      await supabase.from("notifications").insert({
        user_id: userId,
        sender_id: userId,
        room_id: roomId,
        type: "notification_unread", // VALID type from constraint
        message: `You requested to join "${room.name}"`,
        status: "unread",
        created_at: now,
      });

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });
    } else {
      // Public room: Add to both participants and members tables
      const { error: participantsError } = await supabase
        .from("room_participants")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "accepted",
            joined_at: now,
            active: true,
            created_at: now,
          },
          {
            onConflict: "room_id, user_id",
          }
        );

      if (participantsError) {
        console.error("[join] room_participants insert error:", participantsError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to join room",
            code: "JOIN_FAILED",
            details: participantsError.message,
          },
          { status: 400 }
        );
      }

      const { error: membersError } = await supabase
        .from("room_members")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "accepted",
            joined_at: now,
            active: true,
            updated_at: now,
          },
          {
            onConflict: "room_id, user_id",
          }
        );

      if (membersError) {
        console.error("[join] room_members insert error:", membersError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to join room",
            code: "JOIN_FAILED",
            details: membersError.message,
          },
          { status: 400 }
        );
      }

      // Notify room owner about user joining (using valid 'user_joined' type)
      if (room.created_by && room.created_by !== userId) {
        await supabase.from("notifications").insert({
          user_id: room.created_by,
          sender_id: userId,
          room_id: roomId,
          type: "user_joined", // VALID type from constraint
          message: `${senderName} joined "${room.name}"`,
          status: "unread",
          created_at: now,
        });
      }

      // Notify user about successful join (using valid 'notification_unread' type)
      await supabase.from("notifications").insert({
        user_id: userId,
        sender_id: userId,
        room_id: roomId,
        type: "notification_unread", // VALID type from constraint
        message: `You joined "${room.name}"`,
        status: "unread",
        created_at: now,
      });

      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Joined room successfully",
        roomJoined: room,
      });
    }
  } catch (err: any) {
    console.error("[join] Server error:", err.message, err.stack);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: err.message,
      },
      { status: 500 }
    );
  }
}