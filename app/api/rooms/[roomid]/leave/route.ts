import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId?: string; roomid?: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  // Check both roomId and roomid to handle potential naming issues
  const roomId = params.roomId ?? params.roomid;

  // Log the entire params object and roomId for debugging
  console.log(`[Leave Room] Request params:`, params);
  console.log(`[Leave Room] Processing leave request for roomId: ${roomId}`);

  try {
    // 1. Authentication check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error(`[Leave Room] Authentication failed for roomId: ${roomId}`);
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

    // 2. Validate room ID
    if (!roomId) {
      console.error(`[Leave Room] Missing roomId in request parameters`);
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
      console.error(`[Leave Room] Invalid roomId format: ${roomId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid room identifier format",
          code: "INVALID_ROOM_ID"
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
      console.error(`[Leave Room] Room not found for roomId: ${roomId}, error: ${roomError?.message}`);
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
          code: "ROOM_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    // 4. Check membership status in both tables
    const { data: participant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    const { data: member, error: memberError } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if ((participantError && participantError.code !== "PGRST116") ||
      (memberError && memberError.code !== "PGRST116")) {
      console.error(`[Leave Room] Membership check failed for roomId: ${roomId}, participantError: ${participantError?.message}, memberError: ${memberError?.message}`);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify membership",
          code: "MEMBERSHIP_CHECK_FAILED"
        },
        { status: 500 }
      );
    }

    if ((!participant || participant.status !== "accepted") && !member) {
      console.warn(`[Leave Room] User ${userId} is not an active member of roomId: ${roomId}`);
      return NextResponse.json(
        {
          success: false,
          error: "You're not an active member of this room",
          code: "NOT_A_MEMBER"
        },
        { status: 403 }
      );
    }

    // 5. Special handling for room creator
    if (room.created_by === userId) {
      const { count: memberCount, error: countError } = await supabase
        .from("room_members")
        .select("*", { count: "exact" })
        .eq("room_id", roomId);

      if (countError) {
        console.error(`[Leave Room] Failed to verify member count for roomId: ${roomId}, error: ${countError.message}`);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to verify room members",
            code: "MEMBER_COUNT_ERROR"
          },
          { status: 500 }
        );
      }

      if (memberCount && memberCount > 1) {
        console.warn(`[Leave Room] Creator ${userId} cannot leave roomId: ${roomId} with ${memberCount} members`);
        return NextResponse.json(
          {
            success: false,
            error: "As room creator, you must transfer ownership before leaving",
            code: "CREATOR_CANNOT_LEAVE",
            solution: "Please assign a new owner first"
          },
          { status: 400 }
        );
      }

      // Delete room if creator is the last member
      const { error: deleteError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (deleteError) {
        console.error(`[Leave Room] Failed to delete roomId: ${roomId}, error: ${deleteError.message}`);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to delete empty room",
            code: "ROOM_DELETION_FAILED"
          },
          { status: 500 }
        );
      }
    }

    // 6. Remove from both tables
    const { error: leaveParticipantError } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    const { error: leaveMemberError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (leaveParticipantError || leaveMemberError) {
      console.error(`[Leave Room] Failed to leave roomId: ${roomId}, participantError: ${leaveParticipantError?.message}, memberError: ${leaveMemberError?.message}`);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to leave room",
          code: "LEAVE_FAILED"
        },
        { status: 500 }
      );
    }

    // 7. Check for other available rooms
    const { data: otherRooms } = await supabase
      .from("room_participants")
      .select("room_id, rooms(name)")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    const hasOtherRooms = otherRooms && otherRooms.length > 0;
    const defaultRoom = otherRooms?.[0];

    // 8. Create notification
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: "room_left",
        room_id: roomId,
        sender_id: userId,
        message: `You left the room "${room.name}"`,
        status: "unread"
      });

    console.log(`[Leave Room] User ${userId} successfully left roomId: ${roomId}`);

    // 9. Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully left "${room.name}"`,
      roomLeft: {
        id: room.id,
        name: room.name
      },
      hasOtherRooms,
      defaultRoom: hasOtherRooms ? {
        id: defaultRoom?.room_id,
        name: defaultRoom?.rooms?.name
      } : null
    });

  } catch (error) {
    console.error(`[Leave Room] Unexpected error for roomId: ${roomId}`, error);
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

// Handle unsupported HTTP methods
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    },
    {
      status: 405,
      headers: { Allow: "PATCH" }
    }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    },
    {
      status: 405,
      headers: { Allow: "PATCH" }
    }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    },
    {
      status: 405,
      headers: { Allow: "PATCH" }
    }
  );
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    },
    {
      status: 405,
      headers: { Allow: "PATCH" }
    }
  );
}