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

    // Start transaction
    try {
      // Update notification status
      const { error: updateError } = await supabase
        .from("notifications")
        .update({
          status: "read",
          join_status: "accepted",
          updated_at: timestamp,
        })
        .eq("id", notificationId);

      if (updateError) throw updateError;

      if (notification.type === "join_request" || notification.type === "room_invite") {
        const userId = notification.type === "join_request" ? notification.sender_id : notification.user_id;
        if (!userId) {
          throw new Error("Missing user ID for room membership");
        }

        // Add to room_members if not already a member
        const { data: existingMember, error: memberCheckError } = await supabase
          .from("room_members")
          .select("*")
          .eq("room_id", notification.room_id)
          .eq("user_id", userId)
          .single();

        if (memberCheckError && memberCheckError.code !== "PGRST116") throw memberCheckError;

        if (!existingMember) {
          const { error: memberError } = await supabase
            .from("room_members")
            .insert([{
              room_id: notification.room_id,
              user_id: userId,
              joined_at: timestamp,
              role: "member"
            }]);

          if (memberError) throw memberError;
        }

        // Add to room_participants if not already present
        const { data: existingParticipant, error: participantCheckError } = await supabase
          .from("room_participants")
          .select("*")
          .eq("room_id", notification.room_id)
          .eq("user_id", userId)
          .single();

        if (participantCheckError && participantCheckError.code !== "PGRST116") throw participantCheckError;

        if (!existingParticipant) {
          const { error: participantError } = await supabase
            .from("room_participants")
            .insert([{
              room_id: notification.room_id,
              user_id: userId,
              status: "accepted",
              joined_at: timestamp
            }]);

          if (participantError) throw participantError;
        } else if (existingParticipant.status !== "accepted") {
          const { error: updateParticipantError } = await supabase
            .from("room_participants")
            .update({
              status: "accepted",
              joined_at: timestamp
            })
            .eq("room_id", notification.room_id)
            .eq("user_id", userId);

          if (updateParticipantError) throw updateParticipantError;
        }
      }

      return NextResponse.json({ message: "Request accepted successfully" });
    } catch (error) {
      console.error("[Notifications Accept] Transaction error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Notifications Accept] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to accept request" }, { status: 500 });
  }
}

// Fallback handlers for unsupported methods
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}

export async function GET() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}


export async function DELETE() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}

export async function PUT() {
  return new NextResponse(null, { 
    status: 405, 
    headers: { 
      Allow: "PATCH",
      "Content-Type": "application/json"
    } 
  });
}