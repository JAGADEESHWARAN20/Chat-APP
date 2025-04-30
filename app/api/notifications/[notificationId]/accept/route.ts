import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
     req: NextRequest,
     { params }: { params: { notificationId: string } }
) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const notificationId = params.notificationId;

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Fetch the notification
          const { data: notification, error: notificationError } = await supabase
               .from("notifications")
               .select("room_id, sender_id")
               .eq("id", notificationId)
               .eq("user_id", session.user.id)
               .eq("type", "join_request")
               .single();
          if (notificationError || !notification) {
               return NextResponse.json({ error: "Notification not found" }, { status: 404 });
          }

          // Ensure room_id is not null
          if (!notification.room_id) {
               return NextResponse.json({ error: "Notification is missing room_id" }, { status: 400 });
          }

          // Update room_participants to accepted
          const { error: updateParticipantError } = await supabase
               .from("room_participants")
               .update({ status: "accepted" })
               .eq("room_id", notification.room_id)
               .eq("user_id", notification.sender_id);
          if (updateParticipantError) {
               console.error("Error updating room_participants:", updateParticipantError);
               return NextResponse.json({ error: "Failed to accept join request" }, { status: 500 });
          }

          // Add to room_members if not already present
          const { data: existingMember, error: memberError } = await supabase
               .from("room_members")
               .select("*")
               .eq("room_id", notification.room_id)
               .eq("user_id", notification.sender_id)
               .single();
          if (memberError && memberError.code !== "PGRST116") {
               console.error("Error checking room_members:", memberError);
               return NextResponse.json({ error: "Failed to check room_members" }, { status: 500 });
          }

          if (!existingMember) {
               const { error: insertMemberError } = await supabase
                    .from("room_members")
                    .insert({
                         room_id: notification.room_id,
                         user_id: notification.sender_id,
                         active: false, // Not active by default; user can switch to it
                    });
               if (insertMemberError) {
                    console.error("Error adding to room_members:", insertMemberError);
                    return NextResponse.json({ error: "Failed to add to room_members" }, { status: 500 });
               }
          }

          // Mark notification as read
          const { error: updateNotificationError } = await supabase
               .from("notifications")
               .update({ status: "read" })
               .eq("id", notificationId);
          if (updateNotificationError) {
               console.error("Error marking notification as read:", updateNotificationError);
               // Continue, but log the error (non-critical)
          }

          return NextResponse.json({ success: true, message: "Join request accepted" });
     } catch (error) {
          console.error("Server error in accept route:", error);
          return NextResponse.json(
               { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
               { status: 500 }
          );
     }
}