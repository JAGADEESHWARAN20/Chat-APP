// api/notifications/[notificationId]/read/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const cookieStore = cookies();
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore if called from Server Component
        }
      },
    },
  }
);
  const { notificationId } = params;

  try {
    // Get the authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the notification belongs to the user
    // No need to fetch room_id or message if not sending related notifications
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id") // Only fetch what's necessary for verification
      .eq("id", notificationId)
      .eq("user_id", session.user.id)
      .single();
    if (fetchError || !notification) {
      return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 });
    }

    // Update the notification status to "read"
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", notificationId);
    if (updateError) {
      throw updateError;
    }

    // ⛔️ REMOVED: Logic to notify other room members about a notification being marked as read.
    // This was likely causing excessive and irrelevant notifications.

    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Read API] Error marking as read:", errorMessage);
    return NextResponse.json({ error: "Failed to mark notification as read", details: errorMessage }, { status: 500 });
  }
}

// Keep OPTIONS, GET, DELETE, PUT as is (or remove if not used)
export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
export async function GET() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
export async function DELETE() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
export async function PUT() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } }); }
