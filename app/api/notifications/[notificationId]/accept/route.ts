// Update the accept API route (/app/api/notifications/[notificationId]/accept/route.ts) 
// to ensure memberCount reflects the updated count after acceptance:
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const notificationId = params.notificationId;

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = session.user.id;

    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();
    if (notifError || !notif) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notif.type !== "join_request") {
      return NextResponse.json({ error: "Not a join request" }, { status: 400 });
    }

    if (notif.user_id !== currentUserId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    if (!notif.sender_id || !notif.room_id) {
      return NextResponse.json({ error: "Missing sender_id or room_id" }, { status: 400 });
    }

    // Call the RPC with retries for race conditions
    let retries = 2;
    let funcError = null;
    while (retries >= 0) {
     // Update the RPC call in /app/api/notifications/[notificationId]/accept/route.ts around line 49:
      const { error } = await supabase.rpc("accept_notification", {
        p_notification_id: notificationId,
        p_target_user_id: currentUserId,  // Changed from p_user_id to p_target_user_id to match the function signature
      });
      funcError = error;
      if (!funcError) break;
      if (retries === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries--;
    }

    if (funcError) {
      console.error("RPC Error:", funcError);
      return NextResponse.json({ error: funcError.message || "Failed to accept join request" }, { status: 500 });
    }

    // Fetch the room details
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, is_private, created_by, created_at")
      .eq("id", notif.room_id)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found after acceptance" }, { status: 404 });
    }

    // Get updated member count (only from room_members as per your earlier fix)
    const { count: memberCount, error: countError } = await supabase
      .from("room_members")
      .select("user_id", { count: "exact", head: true })
      .eq("room_id", notif.room_id)
      .eq("status", "accepted");

    if (countError) {
      console.error("Count error after acceptance:", countError);
    }

    return NextResponse.json({
      success: true,
      message: "Join request accepted successfully",
      room,
      memberCount: memberCount ?? 1,  // At least 1 (the new member)
    });
  } catch (err: any) {
    console.error("Accept API error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}