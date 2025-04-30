import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const { roomId } = await req.json();

          // Validate session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message || "No session found");
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Check membership in room_members
          const { data: membership, error: membershipError } = await supabase
               .from("room_members")
               .select("*")
               .eq("room_id", roomId)
               .eq("user_id", session.user.id)
               .single();
          if (membershipError && membershipError.code !== "PGRST116") {
               console.error("Membership error:", membershipError?.message);
               return NextResponse.json({ error: "Failed to check membership" }, { status: 500 });
          }

          // If not in room_members, check room_participants and sync if necessary
          if (!membership) {
               const { data: participant, error: participantError } = await supabase
                    .from("room_participants")
                    .select("status")
                    .eq("room_id", roomId)
                    .eq("user_id", session.user.id)
                    .single();
               if (participantError && participantError.code !== "PGRST116") {
                    console.error("Participant error:", participantError?.message);
                    return NextResponse.json({ error: "Failed to check participant status" }, { status: 500 });
               }
               if (!participant || participant.status !== "accepted") {
                    return NextResponse.json({ error: "You are not a member of this room" }, { status: 404 });
               }

               // Sync with room_members for public rooms
               const { data: room, error: roomError } = await supabase
                    .from("rooms")
                    .select("is_private")
                    .eq("id", roomId)
                    .single();
               if (roomError || !room) {
                    return NextResponse.json({ error: "Room not found" }, { status: 404 });
               }

               if (!room.is_private) {
                    // Deactivate all other rooms
                    const { error: deactivateError } = await supabase
                         .from("room_members")
                         .update({ active: false })
                         .eq("user_id", session.user.id);
                    if (deactivateError) {
                         console.error("Error deactivating other rooms:", deactivateError.message);
                    }

                    // Add to room_members
                    const { error: membershipError } = await supabase
                         .from("room_members")
                         .upsert(
                              [
                                   {
                                        room_id: roomId,
                                        user_id: session.user.id,
                                        active: true,
                                   },
                              ],
                              { onConflict: "room_id,user_id" }
                         );
                    if (membershipError) {
                         console.error("Error adding to room_members:", membershipError.message);
                         return NextResponse.json({ error: "Failed to sync membership" }, { status: 500 });
                    }
               }
          }

          // Transaction to manage active room
          const transaction = async () => {
               // Deactivate all other rooms for the user
               const { error: deactivateError } = await supabase
                    .from("room_members")
                    .update({ active: false })
                    .eq("user_id", session.user.id)
                    .neq("room_id", roomId);
               if (deactivateError) {
                    console.error("Error deactivating other rooms:", deactivateError.message);
                    throw new Error(`Failed to deactivate other rooms: ${deactivateError.message}`);
               }

               // Activate the selected room
               const { error: activateError } = await supabase
                    .from("room_members")
                    .update({ active: true })
                    .eq("room_id", roomId)
                    .eq("user_id", session.user.id);
               if (activateError) {
                    console.error("Error activating room:", activateError.message);
                    throw new Error(`Failed to activate room: ${activateError.message}`);
               }

               // Fetch the currently active room
               const { data: currentRoom, error: currentRoomError } = await supabase
                    .from("room_members")
                    .select("room_id")
                    .eq("user_id", session.user.id)
                    .eq("active", true)
                    .single();
               if (currentRoomError || !currentRoom) {
                    console.error("Error fetching current room:", currentRoomError?.message || "No active room found");
                    throw new Error("No active room found after switch");
               }

               // Fetch room details
               const { data: room, error: roomError } = await supabase
                    .from("rooms")
                    .select("name, created_by")
                    .eq("id", currentRoom.room_id)
                    .single();
               if (roomError || !room) {
                    console.error("Error fetching room details:", roomError?.message || "Room not found");
                    throw new Error("Room not found");
               }

               // Send notification to room creator
               const { data: user, error: userError } = await supabase
                    .from("users")
                    .select("username")
                    .eq("id", session.user.id)
                    .single();
               if (userError || !user) {
                    console.error("Error fetching user:", userError?.message || "User not found");
                    throw new Error("User not found");
               }

               const message = `${user.username || "A user"} switched to ${room.name}`;
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
                    // Log the error but don't fail the transaction
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