import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

type NotificationCore = {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: "join_request" | "room_invite" | "message";
  sender_id: string;
  user_id: string;
  room_id: string;
  join_status: string | null;
  direct_chat_id: string | null;
};

export async function POST(req: NextRequest, { params }: { params: { notificationId: string } }) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const timestamp = new Date().toISOString();
  
  try {
    const notificationId = params.notificationId;

    // Validate notificationId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!notificationId || !uuidRegex.test(notificationId)) {
      console.error(`[Notifications Accept] Invalid notification ID: ${notificationId}`);
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[Notifications Accept] Session error:", sessionError?.message);
      return NextResponse.json({ error: "Authentication error", details: sessionError.message }, { status: 401 });
    }
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized: No active session" }, { status: 401 });
    }

    // Fetch notification with detailed error logging
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError || !notification) {
      console.error("[Notifications Accept] Error fetching notification:", notificationError?.message);
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // Validate required fields
    if (!notification.room_id) {
      console.error("[Notifications Accept] Missing room_id");
      return NextResponse.json({ error: "Invalid notification: missing room_id" }, { status: 400 });
    }

    // Start transaction for atomic operations
    const userId = notification.type === "join_request" ? notification.sender_id : notification.user_id;
    if (!userId) {
      throw new Error("Missing user ID for room membership");
    }

    // 1. Verify room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, is_private")
      .eq("id", notification.room_id)
      .single();

    if (roomError || !room) {
      console.error("[Notifications Accept] Room not found:", roomError?.message);
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // 2. Check if already a member to avoid duplicate entries
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", notification.room_id)
      .eq("user_id", userId)
      .single();

    if (memberCheckError && memberCheckError.code !== "PGRST116") {
      console.error("[Notifications Accept] Error checking membership:", memberCheckError.message);
      return NextResponse.json({ error: "Failed to verify membership" }, { status: 500 });
    }

    const { data: existingParticipant, error: participantCheckError } = await supabase
      .from("room_participants")
      .select("*")
      .eq("room_id", notification.room_id)
      .eq("user_id", userId)
      .single();

    if (participantCheckError && participantCheckError.code !== "PGRST116") {
      console.error("[Notifications Accept] Error checking participation:", participantCheckError.message);
      return NextResponse.json({ error: "Failed to verify participation" }, { status: 500 });
    }

    console.log("[Notifications Accept] Current state:", {
      room,
      existingMember: existingMember || "none",
      existingParticipant: existingParticipant || "none"
    });

    // 3. Update notification first
    const { error: updateError } = await supabase
      .from("notifications")
      .update({
        status: "read",
        join_status: "accepted",
        updated_at: timestamp,
      })
      .eq("id", notificationId);

    if (updateError) {
      console.error("[Notifications Accept] Error updating notification:", updateError.message);
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
    }

    // 4. Add to room_members if not present
    if (!existingMember) {
      const { error: memberError } = await supabase
        .from("room_members")
        .insert([{
          room_id: notification.room_id,
          user_id: userId,
          joined_at: timestamp,
          status: "accepted",
          active: false,
          updated_at: timestamp
        }]);

      if (memberError) {
        console.error("[Notifications Accept] Error adding member:", memberError.message);
        return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
      }
    }

    // 5. Update or add room_participant
    const participantData = {
      room_id: notification.room_id,
      user_id: userId,
      status: "accepted",
      joined_at: timestamp
    };

    if (existingParticipant) {
      const { error: updateParticipantError } = await supabase
        .from("room_participants")
        .update(participantData)
        .eq("room_id", notification.room_id)
        .eq("user_id", userId);

      if (updateParticipantError) {
        console.error("[Notifications Accept] Error updating participant:", updateParticipantError.message);
        return NextResponse.json({ error: "Failed to update participant" }, { status: 500 });
      }
    } else {
      const { error: insertParticipantError } = await supabase
        .from("room_participants")
        .insert([participantData]);

      if (insertParticipantError) {
        console.error("[Notifications Accept] Error inserting participant:", insertParticipantError.message);
        return NextResponse.json({ error: "Failed to add participant" }, { status: 500 });
      }
    }

    console.log("[Notifications Accept] Successfully processed request:", {
      notificationId,
      roomId: notification.room_id,
      userId
    });

    return NextResponse.json({ message: "Request accepted successfully" });
  } catch (error) {
    console.error("[Notifications Accept] Unexpected error:", error);
    return NextResponse.json({ 
      error: "Failed to accept request", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

// Fallback handlers for unsupported methods
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { Allow: "POST", "Content-Type": "application/json" } 
  });
}

export async function GET() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { Allow: "POST", "Content-Type": "application/json" } 
  });
}

export async function DELETE() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { Allow: "POST", "Content-Type": "application/json" } 
  });
}

export async function PUT() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { Allow: "POST", "Content-Type": "application/json" } 
  });
}