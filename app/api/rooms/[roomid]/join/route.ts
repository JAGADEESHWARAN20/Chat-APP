import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const roomId = params.roomId;

    if (!roomId || roomId === "undefined") {
      return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
    }

    console.log("Joining room:", roomId);

    // Validate room exists and get its details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, created_by, name, is_private")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      console.error("Room fetch error:", roomError?.message);
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if the user is already a participant
    const { data: existingParticipant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (participantError && participantError.code !== "PGRST116") {
      console.error("Participant fetch error:", participantError.message);
      return NextResponse.json({ error: "Failed to check participation" }, { status: 500 });
    }

    // If already a participant with "accepted" status, return early
    if (existingParticipant && existingParticipant.status === "accepted") {
      return NextResponse.json(
        { message: "Already a member of this room", status: "accepted" },
        { status: 200 }
      );
    }

    // Determine status and joined_at based on room privacy
    const status = room.is_private ? "pending" : "accepted";
    const joined_at = room.is_private ? null : new Date().toISOString();

    // Upsert into room_participants to handle duplicates
    const { error: partError } = await supabase
      .from("room_participants")
      .upsert(
        [
          {
            room_id: roomId,
            user_id: userId,
            status: status,
            joined_at: joined_at,
          },
        ],
        { onConflict: "room_id,user_id" }
      );

    if (partError) {
      console.error("room_participants upsert error:", partError);
      return NextResponse.json(
        { error: "Failed to join room", details: partError.message },
        { status: 500 }
      );
    }

    // If not private, add to room_members
    if (!room.is_private) {
      const { error: memberError } = await supabase
        .from("room_members")
        .upsert(
          [
            {
              room_id: roomId,
              user_id: userId,
              active: true,
            },
          ],
          { onConflict: "room_id,user_id" }
        );

      if (memberError) {
        console.error("room_members upsert error:", memberError);
        return NextResponse.json(
          { error: "Failed to add to room members", details: memberError.message },
          { status: 500 }
        );
      }
    }

    // Only send a notification if the user wasn't already "accepted"
    if (!existingParticipant || existingParticipant.status !== "accepted") {
      const recipientId = room.is_private ? room.created_by : userId;
      if (!recipientId) {
        console.error("Recipient ID is null");
        return NextResponse.json({ error: "Invalid recipient ID" }, { status: 400 });
      }

      const type = room.is_private ? "join_request" : "room_switch";
      const message = room.is_private
        ? `${session.user.email || "A user"} requested to join "${room.name}"`
        : `You joined "${room.name}"`;

      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: recipientId,
          sender_id: userId,
          room_id: roomId,
          type: type,
          message: message,
          status: "unread",
          created_at: new Date().toISOString(),
        });

      if (notifError) {
        console.error("notifications insert error:", notifError.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        status: status,
        message: room.is_private ? "Join request sent" : "Joined room successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in join route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}