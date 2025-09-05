import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomid: string } } // FIXED: Use lowercase 'roomid'
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { roomid: roomId } = params; // FIXED: Extract as roomid and alias to roomId

    console.log("[join] Params received:", params);
    console.log("[join] Room ID extracted:", roomId); // Add this for debugging

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

    // 5. Call the database function to handle the join logic
    const { error: joinError } = await supabase.rpc('join_room', {
      p_room_id: roomId,
      p_user_id: userId
    });

    if (joinError) {
      console.error("[join] join_room function error:", joinError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to join room",
          code: "JOIN_FAILED",
          details: joinError.message,
        },
        { status: 400 }
      );
    }

    // 6. Return appropriate response based on room type
    if (room.is_private) {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });
    } else {
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