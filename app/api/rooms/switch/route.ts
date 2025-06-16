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

          // Validate roomId
          if (!roomId || typeof roomId !== "string") {
               return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
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
                    // Add to room_members (without setting active yet)
                    const { error: membershipError } = await supabase
                         .from("room_members")
                         .upsert(
                              [
                                   {
                                        room_id: roomId,
                                        user_id: session.user.id,
                                        active: false, // Do not set active here; handle in transaction
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

          // Transaction to manage active room in room_members
          const transaction = async () => {
               // Step 1: Deactivate all rooms for the user in room_members
               const { error: deactivateMembersError } = await supabase
                    .from("room_members")
                    .update({ active: false })
                    .eq("user_id", session.user.id);
               if (deactivateMembersError) {
                    console.error("Error deactivating rooms in room_members:", deactivateMembersError.message);
                    throw new Error(`Failed to deactivate rooms in room_members: ${deactivateMembersError.message}`);
               }

               // Step 2: Activate the selected room in room_members
               const { data: updatedMembership, error: activateMembersError } = await supabase
                    .from("room_members")
                    .update({ active: true })
                    .eq("room_id", roomId)
                    .eq("user_id", session.user.id)
                    .select()
                    .single();
               if (activateMembersError || !updatedMembership) {
                    console.error("Error activating room in room_members:", activateMembersError?.message || "No membership found");
                    throw new Error(`Failed to activate room in room_members: ${activateMembersError?.message || "No membership found"}`);
               }

               // Step 3: Verify exactly one active room exists
               const { data: activeRooms, error: activeRoomsError } = await supabase
                    .from("room_members")
                    .select("room_id")
                    .eq("user_id", session.user.id)
                    .eq("active", true);
               if (activeRoomsError) {
                    console.error("Error fetching active rooms:", activeRoomsError.message);
                    throw new Error(`Failed to verify active room: ${activeRoomsError.message}`);
               }
               if (!activeRooms || activeRooms.length === 0) {
                    console.error("No active rooms found after switch");
                    throw new Error("No active room found after switch");
               }
               if (activeRooms.length > 1) {
                    console.error("Multiple active rooms found after switch:", activeRooms);
                    // Fix by deactivating others and keeping the intended room active
                    const { error: fixError } = await supabase
                         .from("room_members")
                         .update({ active: false })
                         .eq("user_id", session.user.id)
                         .neq("room_id", roomId);
                    if (fixError) {
                         console.error("Error fixing multiple active rooms:", fixError.message);
                         throw new Error(`Failed to fix multiple active rooms: ${fixError.message}`);
                    }
               }

               // Step 4: Fetch the currently active room to confirm
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
               if (currentRoom.room_id !== roomId) {
                    console.error("Active room does not match requested room:", currentRoom.room_id, roomId);
                    throw new Error("Active room mismatch after switch");
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