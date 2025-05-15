import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId?: string; roomid?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  // Handle both roomId and roomid due to potential folder naming
  const roomId = params.roomId ?? params.roomid;

  // Log params and roomId
  console.log(`[Join Room] Request params:`, params);
  console.log(`[Join Room] Processing join request for roomId: ${roomId}`);

  try {
    // 1. Authentication check
    console.log(`[Join Room] Checking authentication for roomId: ${roomId}`);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error(`[Join Room] Authentication failed for roomId: ${roomId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }
    console.log(`[Join Room] Authentication successful for roomId: ${roomId}, userId: ${session.user.id}`);

    const userId = session.user.id;

    // 2. Validate room ID
    console.log(`[Join Room] Validating roomId: ${roomId}`);
    if (!roomId) {
      console.error(`[Join Room] Missing roomId in request parameters`);
      return NextResponse.json(
        {
          success: false,
          error: "Room identifier is missing",
          code: "MISSING_ROOM_ID"
        },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(roomId)) {
      console.error(`[Join Room] Invalid roomId format: ${roomId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid room identifier format",
          code: "INVALID_ROOM_ID"
        },
        { status: 400 }
      );
    }
    console.log(`[Join Room] RoomId validation successful for roomId: ${roomId}`);

    // 3. Verify room exists and get details
    console.log(`[Join Room] Fetching room details for roomId: ${roomId}`);
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      console.error(`[Join Room] Room not found for roomId: ${roomId}, error: ${roomError?.message}`);
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
          code: "ROOM_NOT_FOUND"
        },
        { status: 404 }
      );
    }
    console.log(`[Join Room] Room fetch successful for roomId: ${roomId}, room:`, {
      id: room.id,
      name: room.name,
      is_private: room.is_private
    });

    // 4. Check existing participation status
    console.log(`[Join Room] Checking participation status for roomId: ${roomId}, userId: ${userId}`);
    const { data: existingParticipant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (participantError && participantError.code !== "PGRST116") {
      console.error(`[Join Room] Participation check failed for roomId: ${roomId}, error: ${participantError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to check participation status",
          code: "PARTICIPATION_CHECK_FAILED"
        },
        { status: 500 }
      );
    }
    console.log(`[Join Room] Participation check successful for roomId: ${roomId}, existingParticipant:`, existingParticipant || 'None');

    // 5. Handle already accepted members
    if (existingParticipant?.status === "accepted") {
      console.log(`[Join Room] User is already accepted for roomId: ${roomId}, checking room_members`);
      const { data: existingMember } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (!existingMember) {
        console.log(`[Join Room] Adding user to room_members for roomId: ${roomId}`);
        const { error: memberInsertError } = await supabase
          .from("room_members")
          .insert({
            room_id: roomId,
            user_id: userId,
            status: "accepted"
          });

        if (memberInsertError) {
          console.error(`[Join Room] Failed to add to room_members for roomId: ${roomId}, error: ${memberInsertError.message}`);
          return NextResponse.json(
            {
              success: false,
              error: "Failed to add to room members",
            },
            { status: 500 }
          );
        }
        console.log(`[Join Room] Successfully added to room_members for roomId: ${roomId}`);
      } else {
        console.log(`[Join Room] User already in room_members for roomId: ${roomId}`);
      }

      return NextResponse.json(
        {
          success: true,
          status: "accepted",
          message: "Already a member of this room",
          roomJoined: {
            id: room.id,
            name: room.name,
            is_private: room.is_private
          }
        },
        { status: 200 }
      );
    }

    // 6. Determine join status based on room privacy
    console.log(`[Join Room] Determining join status for roomId: ${roomId}`);
    const status = room.is_private ? "pending" : "accepted";
    const joined_at = room.is_private ? null : new Date().toISOString();
    console.log(`[Join Room] Join status determined for roomId: ${roomId}`, { status, joined_at });

    // 7. Upsert participation record
    console.log(`[Join Room] Upserting participation record for roomId: ${roomId}`);
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
      console.error(`[Join Room] Participation upsert failed for roomId: ${roomId}, error: ${upsertError.message}`);
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
    console.log(`[Join Room] Participation upsert successful for roomId: ${roomId}`);

    // 8. For non-private rooms, add to members immediately
    if (!room.is_private) {
      console.log(`[Join Room] Adding to room_members for non-private roomId: ${roomId}`);
      const { error: memberError } = await supabase
        .from("room_members")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            status: "accepted"
          },
          { onConflict: "room_id,user_id" }
        );

      if (memberError) {
        console.error(`[Join Room] Failed to add to room_members for roomId: ${roomId}, error: ${memberError.message}`);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to add to room members",
            code: "MEMBER_ADD_FAILED"
          },
          { status: 500 }
        );
      }
      console.log(`[Join Room] Successfully added to room_members for roomId: ${roomId}`);
    }

    // 9. Validate room creator for private rooms
    console.log(`[Join Room] Validating room creator for roomId: ${roomId}`);
    if (room.is_private && !room.created_by) {
      console.error(`[Join Room] Room creator not found for private roomId: ${roomId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Room creator not found for private room",
          code: "CREATOR_NOT_FOUND"
        },
        { status: 500 }
      );
    }
    console.log(`[Join Room] Room creator validation successful for roomId: ${roomId}`);

    // 10. Send appropriate notification
    console.log(`[Join Room] Creating notification for roomId: ${roomId}`);
    const notification = {
      user_id: room.is_private ? room.created_by! : userId,
      sender_id: userId,
      room_id: roomId,
      type: room.is_private ? "join_request" : "room_joined",
      message: room.is_private
        ? `${session.user.email || "A user"} requested to join "${room.name}"`
        : `You joined "${room.name}"`,
      status: "unread"
    };

    const { error: notificationError } = await supabase.from("notifications").insert(notification);
    if (notificationError) {
      console.error(`[Join Room] Notification insert failed for roomId: ${roomId}, error: ${notificationError.message}`);
      // Continue despite notification error to maintain core functionality
    } else {
      console.log(`[Join Room] Notification insert successful for roomId: ${roomId}`);
    }

    // 11. Return success response
    console.log(`[Join Room] User ${userId} successfully joined roomId: ${roomId}`);
    return NextResponse.json(
      {
        success: true,
        status: status,
        message: room.is_private
          ? "Join request sent to room admin"
          : "Successfully joined room",
        roomJoined: {
          id: room.id,
          name: room.name,
          is_private: room.is_private
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(`[Join Room] Unexpected error for roomId: ${roomId}`, error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}