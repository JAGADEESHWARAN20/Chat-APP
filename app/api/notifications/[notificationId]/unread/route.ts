// api/notifications/[notificationId]/unread/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { notificationId: string } }) {
  const supabase = await supabaseServer();
  const { notificationId } = params;

  try {
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the notification belongs to the user
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id") // Only need ID and user_id for verification
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 });
    }

    // Update the notification status to "unread"
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ status: "unread" })
      .eq("id", notificationId)
      .eq("user_id", user.id); // Double-check user_id for security

    if (updateError) {
      throw updateError;
    }

    // ⛔️ REMOVED: Logic to notify other room members about a notification being marked as unread.
    // This was likely causing excessive and irrelevant notifications.

    return NextResponse.json({ message: "Notification marked as unread" }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Unread API] Error marking as unread:", errorMessage);
    return NextResponse.json({ error: errorMessage || "Failed to mark as unread" }, { status: 500 });
  }
}
