import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const { roomId } = await req.json();

          // Step 1: Validate session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message || "No session found");
               return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
          }

          // Step 2: Validate roomId
          if (!roomId || typeof roomId !== "string") {
               return NextResponse.json({ error: "Invalid room ID", code: "INVALID_ROOM_ID" }, { status: 400 });
          }

          // Step 3: Fetch room details to check existence and ownership
          const { data: room, error: roomError } = await supabase
               .from("rooms")
               .select("id, name, created_by, is_private")
               .eq("id", roomId)
               .single();
          if (roomError || !room) {
               console.error("Room fetch error:", roomError?.message);
               return NextResponse.json({ error: "Room not found", code: "ROOM_NOT_FOUND" }, { status: 404 });
          }

          const userId = session.user.id;
          const isRoomOwner = room.created_by === userId;

          // Step 4: Enforce specific user restrictions
          if (userId === "0e4f6719-76a2-4c01-964a-ac860d27f1a3") {
               const allowedRooms = ["16d4f46e-4408-4634-9983-ac5cdec2e54e", "0d47f593-01ef-4ba7-bdb3-33a112ab8263"];
               if (!allowedRooms.includes(roomId)) {
                    return NextResponse.json(
                         { error: "You are not allowed to switch to this room", code: "ACCESS_DENIED" },
                         { status: 403 }
                    );
               }
          } else if (userId === "3487d37f-88f9-438f-8a13-3d15832da76a") {
               const restrictedRoom = "0d47f593-01ef-4ba7-bdb3-33a112ab8263";
               if (roomId === restrictedRoom) {
                    return NextResponse.json(
                         { error: "You are not allowed to switch to this room", code: "ACCESS_DENIED" },
                         { status: 403 }
                    );
               }
          }

          // Step 5: Check membership in room_members
          const { data: membership, error: membershipError } = await supabase
               .from("room_members")
               .select("status")
               .eq("room_id", roomId)
               .eq("user_id", userId)
               .single();
          if (membershipError && membershipError.code !== "PGRST116") {
               console.error("Membership error:", membershipError?.message);
               return NextResponse.json({ error: "Failed to check membership", code: "MEMBERSHIP_CHECK_FAILED" }, { status: 500 });
          }

          // Step 6: If user is not a member, check room_participants
          if (!membership) {
               const { data: participant, error: participantError } = await supabase
                    .from("room_participants")
                    .select("status")
                    .eq("room_id", roomId)
                    .eq("user_id", userId)
                    .single();
               if (participantError && participantError.code !== "PGRST116") {
                    console.error("Participant error:", participantError?.message);
                    return NextResponse.json({ error: "Failed to check participant status", code: "PARTICIPATION_CHECK_FAILED" }, { status: 500 });
               }

               // If not in room_participants, create a pending request
               if (!participant) {
                    if (isRoomOwner) {
                         // Room owner can join directly
                         const { error: joinError } = await supabase
                              .from("room_members")
                              .insert({ room_id: roomId, user_id: userId, status: "accepted", active: false });
                         if (joinError) {
                              console.error("Error adding owner to room_members:", joinError.message);
                              return NextResponse.json({ error: "Failed to join room", code: "MEMBER_ADD_FAILED" }, { status: 500 });
                         }
                    } else {
                         // Send a notification to the room owner for approval
                         const { error: participantInsertError } = await supabase
                              .from("room_participants")
                              .insert({ room_id: roomId, user_id: userId, status: "pending" });
                         if (participantInsertError) {
                              console.error("Error creating participant request:", participantInsertError.message);
                              return NextResponse.json({ error: "Failed to request room switch", code: "PARTICIPANT_INSERT_FAILED" }, { status: 500 });
                         }

                         const { error: notificationError } = await supabase
                              .from("notifications")
                              .insert({
                                   user_id: room.created_by, // Notify the room owner
                                   type: "room_switch",
                                   room_id: roomId,
                                   sender_id: userId,
                                   message: `User ${session.user.email} requests to switch to room "${room.name}"`,
                                   status: "unread",
                                   join_status: "pending",
                              });
                         if (notificationError) {
                              console.error("Error sending notification:", notificationError.message);
                              return NextResponse.json({ error: "Failed to send switch request", code: "NOTIFICATION_FAILED" }, { status: 500 });
                         }

                         return NextResponse.json(
                              { success: false, message: "Switch request sent to room owner for approval", status: "pending" },
                              { status: 200 }
                         );
                    }
               } else if (participant.status !== "accepted") {
                    // If participant status is pending or rejected, return appropriate message
                    if (participant.status === "pending") {
                         return NextResponse.json(
                              { success: false, message: "Your request to switch to this room is still pending", status: "pending" },
                              { status: 200 }
                         );
                    }
                    return NextResponse.json(
                         { error: "You are not an accepted member of this room", code: "NOT_A_MEMBER" },
                         { status: 403 }
                    );
               }

               // Sync room_participants with room_members if status is accepted
               const { error: membershipInsertError } = await supabase
                    .from("room_members")
                    .upsert(
                         { room_id: roomId, user_id: userId, status: "accepted", active: false },
                         { onConflict: "room_id,user_id" }
                    );
               if (membershipInsertError) {
                    console.error("Error syncing membership:", membershipInsertError.message);
                    return NextResponse.json({ error: "Failed to sync membership", code: "MEMBER_ADD_FAILED" }, { status: 500 });
               }
          } else if (membership.status !== "accepted") {
               return NextResponse.json(
                    { error: "Your membership status is not accepted", code: "NOT_A_MEMBER" },
                    { status: 403 }
               );
          }

          // Step 7: Transaction to manage active room in room_members
          const transaction = async () => {
               // Deactivate all rooms for the user in room_members
               const { error: deactivateMembersError } = await supabase
                    .from("room_members")
                    .update({ active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", userId);
               if (deactivateMembersError) {
                    console.error("Error deactivating rooms in room_members:", deactivateMembersError.message);
                    throw new Error(`Failed to deactivate rooms in room_members: ${deactivateMembersError.message}`);
               }

               // Activate the selected room in room_members
               const { data: updatedMembership, error: activateMembersError } = await supabase
                    .from("room_members")
                    .update({ active: true, updated_at: new Date().toISOString() })
                    .eq("room_id", roomId)
                    .eq("user_id", userId)
                    .eq("status", "accepted")
                    .select()
                    .single();
               if (activateMembersError || !updatedMembership) {
                    console.error("Error activating room in room_members:", activateMembersError?.message || "No membership found");
                    throw new Error(`Failed to activate room in room_members: ${activateMembersError?.message || "No membership found"}`);
               }

               // Verify exactly one active room exists
               const { data: activeRooms, error: activeRoomsError } = await supabase
                    .from("room_members")
                    .select("room_id")
                    .eq("user_id", userId)
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
                    const { error: fixError } = await supabase
                         .from("room_members")
                         .update({ active: false, updated_at: new Date().toISOString() })
                         .eq("user_id", userId)
                         .neq("room_id", roomId);
                    if (fixError) {
                         console.error("Error fixing multiple active rooms:", fixError.message);
                         throw new Error(`Failed to fix multiple active rooms: ${fixError.message}`);
                    }
               }

               // Fetch the currently active room to confirm
               const { data: currentRoom, error: currentRoomError } = await supabase
                    .from("room_members")
                    .select("room_id")
                    .eq("user_id", userId)
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