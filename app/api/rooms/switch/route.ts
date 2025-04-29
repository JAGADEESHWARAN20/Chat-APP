import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const { roomId } = await req.json();

          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message || "No session found");
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const { data: membership, error: membershipError } = await supabase
               .from("room_members")
               .select("*")
               .eq("room_id", roomId)
               .eq("user_id", session.user.id)
               .single();
          if (membershipError || !membership) {
               console.error("Membership error:", membershipError?.message || "No membership found");
               return NextResponse.json({ error: "You are not a member of this room" }, { status: 404 });
          }

          const transaction = async () => {
               const { error: deactivateError } = await supabase
                    .from("room_members")
                    .update({ active: false })
                    .eq("user_id", session.user.id)
                    .neq("room_id", roomId);
               if (deactivateError) throw deactivateError;

               const { error: activateError } = await supabase
                    .from("room_members")
                    .update({ active: true })
                    .eq("room_id", roomId)
                    .eq("user_id", session.user.id);
               if (activateError) throw activateError;

               const { data: currentRoom } = await supabase
                    .from("room_members")
                    .select("room_id")
                    .eq("user_id", session.user.id)
                    .eq("active", true)
                    .single();
               const { data: room } = await supabase
                    .from("rooms")
                    .select("name, created_by")
                    .eq("id", currentRoom?.room_id || roomId)
                    .single();
               if (room) {
                    const { data: user } = await supabase
                         .from("users")
                         .select("username")
                         .eq("id", session.user.id)
                         .single();
                    const message = `${user?.username || "A user"} switched to ${room.name}`;
                    const { error: notificationError } = await supabase
                         .from("notifications")
                         .insert([
                              {
                                   user_id: room.created_by,
                                   type: "room_switch",
                                   room_id: roomId,
                                   sender_id: session.user.id,
                                   message,
                                   status: "unread",
                              },
                         ]);
                    if (notificationError) {
                         console.error("Error sending notification:", notificationError.message);
                    }
               }
          };

          await transaction();

          return NextResponse.json({ success: true, message: `Switched to room ${roomId}` });
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Server error in switch route:", errorMessage, error);
          return NextResponse.json({ error: "Failed to switch room", details: errorMessage }, { status: 500 });
     }
}