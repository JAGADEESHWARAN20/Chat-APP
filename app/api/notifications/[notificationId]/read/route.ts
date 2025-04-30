import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
     req: NextRequest,
     { params }: { params: { notificationId: string } }
) {
     const supabase = createRouteHandlerClient({ cookies });
     const { notificationId } = params;

     try {
          // Get the authenticated user
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Verify the notification belongs to the user
          const { data: notification, error: fetchError } = await supabase
               .from("notifications")
               .select("id, user_id")
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

          return NextResponse.json({ success: true, message: "Notification marked as read" });
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return NextResponse.json({ error: "Failed to mark notification as read", details: errorMessage }, { status: 500 });
     }
}