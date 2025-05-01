import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Fetch notifications for the user
          const { data: notifications, error: fetchError } = await supabase
               .from("notifications")
               .select(`
                    id,
                    content,
                    created_at,
                    is_read,
                    type,
                    sender_id,
                    room_id,
                    users!sender_id (
                         id,
                         username,
                         display_name,
                         avatar_url
                    ),
                    rooms (
                         id,
                         name
                    )
                    `)
               .eq("receiver_id", session.user.id)
               .order("created_at", { ascending: false });

          if (fetchError) {
               console.error("Error fetching notifications:", fetchError);
               return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
          }

          return NextResponse.json({ success: true, notifications });
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Server error in notifications route:", errorMessage, error);
          return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
     }
}