// app/api/rooms/[roomId]/join/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    // 1. Authentication check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
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
    const roomId = params.roomId;

    // 2. Validate room ID
    if (!roomId) {
      return NextResponse.json(
        {
          success: false,
          error: "Room ID is required",
          code: "ROOM_ID_REQUIRED"
        },
        { status: 400 }
      );
    }

    // 3. Verify room exists and get details
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

    // 4. Check existing participation status
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

    // 5. Handle already accepted members
    if (existingParticipant?.status === "accepted") {
      // Check if also in room_members
      const { data: existingMember } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (!existingMember) {
        // Add to room_members if not already there
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

    // 6. Determine join status based on room privacy
    const status = room.is_private ? "pending" : "accepted";
    const joined_at = room.is_private ? null : new Date().toISOString();

    // 7. Upsert participation record
    const { error: upsertError } = await supabase
      .from("room_participants")
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          status: status,
          joined_at: joined_at
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

    // 8. For non-private rooms, add to members immediately
    if (!room.is_private) {
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

   
    // 9. Send appropriate notification
if (room.is_private && !room.created_by) {
  return NextResponse.json(
    {
      success: false,
      error: "Room creator not found for private room",
      code: "CREATOR_NOT_FOUND"
    },
    { status: 500 }
  );
}

const notification = {
  user_id: room.is_private ? room.created_by! : userId, // Use non-null assertion after validation
  sender_id: userId,
  room_id: roomId,
  type: room.is_private ? "join_request" : "room_joined",
  message: room.is_private
    ? `${session.user.email || "A user"} requested to join "${room.name}"`
    : `You joined "${room.name}"`,
  status: "unread"
};

await supabase.from("notifications").insert(notification);
    // 10. Return success response
    return NextResponse.json(
      {
        success: true,
        status: status,
        message: room.is_private
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
    console.error('[Join Room] Unexpected error:', error);
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