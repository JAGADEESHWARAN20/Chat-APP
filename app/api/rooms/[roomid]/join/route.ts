// app/api/rooms/[roomId]/join/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  context: { params: { roomId?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    // 1. Extract roomId safely
    const roomId = context.params?.roomId;
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Room ID is required in the URL",
          code: "ROOM_ID_REQUIRED"
        },
        { status: 400 }
      );
    }

    // 2. Get user session
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 3. Check if room exists
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
          code: "ROOM_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    // 4. Check if user is already a participant
    const { data: existingParticipant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (participantError && participantError.code !== "PGRST116") {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to check participation status",
          code: "PARTICIPATION_CHECK_FAILED"
        },
        { status: 500 }
      );
    }

    // 5. If already accepted, ensure user is in room_members
    if (existingParticipant?.status === "accepted") {
      const { data: existingMember } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (!existingMember) {
        await supabase
          .from("room_members")
          .insert({
            room_id: roomId,
            user_id: userId,
            active: true
          });
      }

      return NextResponse.json(
        {
          success: true,
          status: "accepted",
          message: "Already a member of this room"
        },
        { status: 200 }
      );
    }

    // 6. Determine join status
    const isPrivate = room.is_private;
    const status = isPrivate ? "pending" : "accepted";
    const joined_at = isPrivate ? null : new Date().toISOString();

    // 7. Upsert to room_participants
    const { error: upsertError } = await supabase
      .from("room_participants")
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          status,
          joined_at
        },
        { onConflict: "room_id,user_id" }
      );

    if (upsertError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to join room",
          code: "JOIN_FAILED",
          details: upsertError.message
        },
        { status: 500 }
      );
    }

    // 8. If public, add to room_members
    if (!isPrivate) {
      const { error: memberError } = await supabase
        .from("room_members")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            active: true
          },
          { onConflict: "room_id,user_id" }
        );

      if (memberError) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to add to room members",
            code: "MEMBER_ADD_FAILED"
          },
          { status: 500 }
        );
      }
    }

    // 9. Validate room creator before sending notification
    if (isPrivate && !room.created_by) {
      return NextResponse.json(
        {
          success: false,
          error: "Room creator not found for private room",
          code: "CREATOR_NOT_FOUND"
        },
        { status: 500 }
      );
    }

    // 10. Send notification
    const notification = {
      user_id: isPrivate ? room.created_by! : userId,
      sender_id: userId,
      room_id: roomId,
      type: isPrivate ? "join_request" : "room_joined",
      message: isPrivate
        ? `${session.user.email || "A user"} requested to join "${room.name}"`
        : `You joined "${room.name}"`,
      status: "unread"
    };

    await supabase.from("notifications").insert(notification);

    // 11. Done!
    return NextResponse.json(
      {
        success: true,
        status,
        message: isPrivate
          ? "Join request sent to room admin"
          : "Successfully joined room",
        room: {
          id: room.id,
          name: room.name,
          is_private: room.is_private
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Join Room] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR"
      },
      { status: 500 }
    );
  }
}
