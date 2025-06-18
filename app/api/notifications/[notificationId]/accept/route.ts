import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

type NotificationType = "join_request" | "room_invite" | "message";

type NotificationCore = {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: NotificationType;
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
    if (sessionError || !session?.user) {
      console.error("[Notifications Accept] Session error:", sessionError?.message);
      return NextResponse.json(
        { error: "Authentication error", details: sessionError?.message || "No active session" }, 
        { status: 401 }
      );
    }

    // First, get the notification details
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError || !notification) {
      console.error("[Notifications Accept] Error fetching notification:", notificationError);
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // Determine which user to add to the room
    const targetUserId = notification.type === "join_request" ? notification.sender_id : notification.user_id;
    if (!targetUserId || !notification.room_id) {
      return NextResponse.json({ error: "Invalid notification data" }, { status: 400 });
    }

    // Begin a series of atomic operations
    const updates = [];

    // 1. Update notification status
    updates.push(supabase
      .from("notifications")
      .update({
        status: "read",
        join_status: "accepted",
        updated_at: timestamp
      })
      .eq("id", notificationId));

    // 2. Add or update room membership
    updates.push(supabase
      .from("room_members")
      .upsert({
        room_id: notification.room_id,
        user_id: targetUserId,
        joined_at: timestamp,
        status: "accepted",
        active: false,
        updated_at: timestamp
      }, {
        onConflict: "room_id,user_id"
      }));

    // 3. Add or update room participation
    updates.push(supabase
      .from("room_participants")
      .upsert({
        room_id: notification.room_id,
        user_id: targetUserId,
        status: "accepted",
        joined_at: timestamp
      }, {
        onConflict: "room_id,user_id"
      }));

    // Execute all updates
    const results = await Promise.all(updates);
    const errors = results.map(r => r.error).filter(Boolean);

    if (errors.length > 0) {
      console.error("[Notifications Accept] Update errors:", errors);
      
      // Check for specific error types
      const hasUniqueViolation = errors.some(e => e?.code === "23505");
      const hasForeignKeyViolation = errors.some(e => e?.code === "23503");
      
      if (hasUniqueViolation) {
        return NextResponse.json({ error: "Already a member of this room" }, { status: 409 });
      } else if (hasForeignKeyViolation) {
        return NextResponse.json({ error: "Invalid room or user reference" }, { status: 400 });
      }
      
      throw new Error("Failed to update room membership");
    }

    console.log("[Notifications Accept] Successfully processed request:", {
      notificationId,
      roomId: notification.room_id,
      userId: targetUserId
    });

    return NextResponse.json({ 
      message: "Request accepted successfully",
      data: {
        notificationId,
        roomId: notification.room_id,
        userId: targetUserId,
        timestamp
      }
    });
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