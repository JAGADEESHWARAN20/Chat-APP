import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const { roomId } = await req.json();

          // Step 1: Validate session
          const {
               data: { session },
               error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError || !session) {
               console.error("Session error:", sessionError?.message || "No session found");
               return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
          }

          // Step 2: Validate roomId
          if (!roomId || typeof roomId !== "string") {
               return NextResponse.json({ error: "Invalid room ID", code: "INVALID_ROOM_ID" }, { status: 400 });
          }

          // Step 3: Fetch room details
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

          // Step 4: Check membership in room_members
          const { data: membership, error: membershipError } = await supabase
               .from("room_members")
               .select("status, active")
               .eq("room_id", roomId)
               .eq("user_id", userId)
               .single();
          if (membershipError && membershipError.code !== "PGRST116") {
               console.error("[Switch Room] Membership error:", membershipError?.message);
               return NextResponse.json(
                    { error: "Failed to check membership", code: "MEMBERSHIP_CHECK_FAILED" },
                    { status: 500 }
               );
          }

          // Step 5: If user is a member and accepted, switch room
          if (membership && membership.status === "accepted") {
               const transaction = async () => {
                    // Deactivate all rooms for the user
                    const { error: deactivateError } = await supabase
                         .from("room_members")
                         .update({ active: false, updated_at: new Date().toISOString() })
                         .eq("user_id", userId);
                    if (deactivateError) {
                         throw new Error(`Failed to deactivate rooms: ${deactivateError.message}`);
                    }

                    // Activate the selected room
                    const { error: activateError } = await supabase
                         .from("room_members")
                         .update({ active: true, updated_at: new Date().toISOString() })
                         .eq("room_id", roomId)
                         .eq("user_id", userId);
                    if (activateError) {
                         throw new Error(`Failed to activate room: ${activateError.message}`);
                    }

                    // Verify exactly one active room
                    const { data: activeRooms, error: activeRoomsError } = await supabase
                         .from("room_members")
                         .select("room_id")
                         .eq("user_id", userId)
                         .eq("active", true);
                    if (activeRoomsError || !activeRooms || activeRooms.length !== 1) {
                         throw new Error("Failed to verify active room state");
                    }
               };

               await transaction();
               return NextResponse.json({ success: true, message: `Switched to room ${room.name}` });
          }

          // Step 6: If not a member, check room_participants
          const { data: participant, error: participantError } = await supabase
               .from("room_participants")
               .select("status")
               .eq("room_id", roomId)
               .eq("user_id", userId)
               .single();
          if (participantError && participantError.code !== "PGRST116") {
               console.error("[Switch Room] Participant error:", participantError?.message);
               return NextResponse.json(
                    { error: "Failed to check participant status", code: "PARTICIPATION_CHECK_FAILED" },
                    { status: 500 }
               );
          }

          // Step 7: Handle based on participant status
          if (participant) {
               if (participant.status === "pending") {
                    return NextResponse.json(
                         { success: false, message: "Your request to switch to this room is still pending", status: "pending" },
                         { status: 200 }
                    );
               }
               if (participant.status !== "accepted") {
                    return NextResponse.json(
                         { error: "You are not an accepted member of this room", code: "NOT_A_MEMBER" },
                         { status: 403 }
                    );
               }

               // If participant is accepted but not in room_members, sync them
               const { error: membershipInsertError } = await supabase
                    .from("room_members")
                    .insert({ room_id: roomId, user_id: userId, status: "accepted", active: false });
               if (membershipInsertError) {
                    console.error("[Switch Room] Error syncing membership:", membershipInsertError.message);
                    return NextResponse.json(
                         { error: "Failed to sync membership", code: "MEMBER_ADD_FAILED" },
                         { status: 500 }
                    );
               }

               // Now switch room (repeat transaction from Step 5)
               const transaction = async () => {
                    const { error: deactivateError } = await supabase
                         .from("room_members")
                         .update({ active: false, updated_at: new Date().toISOString() })
                         .eq("user_id", userId);
                    if (deactivateError) {
                         throw new Error(`Failed to deactivate rooms: ${deactivateError.message}`);
                    }

                    const { error: activateError } = await supabase
                         .from("room_members")
                         .update({ active: true, updated_at: new Date().toISOString() })
                         .eq("room_id", roomId)
                         .eq("user_id", userId);
                    if (activateError) {
                         throw new Error(`Failed to activate room: ${activateError.message}`);
                    }

                    const { data: activeRooms, error: activeRoomsError } = await supabase
                         .from("room_members")
                         .select("room_id")
                         .eq("user_id", userId)
                         .eq("active", true);
                    if (activeRoomsError || !activeRooms || activeRooms.length !== 1) {
                         throw new Error("Failed to verify active room state");
                    }
               };

               await transaction();
               return NextResponse.json({ success: true, message: `Switched to room ${room.name}` });
          }

          // Step 8: If not a participant, create a pending request (unless owner)
          if (isRoomOwner) {
               const { error: joinError } = await supabase
                    .from("room_members")
                    .insert({ room_id: roomId, user_id: userId, status: "accepted", active: true });
               if (joinError) {
                    console.error("[Switch Room] Error adding owner to room_members:", joinError.message);
                    return NextResponse.json(
                         { error: "Failed to join room", code: "MEMBER_ADD_FAILED" },
                         { status: 500 }
                    );
               }

               // Deactivate other rooms
               const { error: deactivateError } = await supabase
                    .from("room_members")
                    .update({ active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", userId)
                    .neq("room_id", roomId);
               if (deactivateError) {
                    console.error("[Switch Room] Error deactivating other rooms:", deactivateError.message);
                    return NextResponse.json(
                         { error: "Failed to deactivate other rooms", code: "DEACTIVATE_FAILED" },
                         { status: 500 }
                    );
               }

               return NextResponse.json({ success: true, message: `Switched to room ${room.name}` });
          }

          // Create a pending request
          const { error: participantInsertError } = await supabase
               .from("room_participants")
               .insert({ room_id: roomId, user_id: userId, status: "pending" });
          if (participantInsertError) {
               console.error("[Switch Room] Error creating participant request:", participantInsertError.message);
               return NextResponse.json(
                    { error: "Failed to request room switch", code: "PARTICIPANT_INSERT_FAILED" },
                    { status: 500 }
               );
          }

          const { error: notificationError } = await supabase
               .from("notifications")
               .insert({
                    user_id: room.created_by,
                    type: "room_switch",
                    room_id: roomId,
                    sender_id: userId,
                    message: `User ${session.user.email} requests to switch to room "${room.name}"`,
                    status: "unread",
                    join_status: "pending",
               });
          if (notificationError) {
               console.error("[Switch Room] Error sending notification:", notificationError.message);
               return NextResponse.json(
                    { error: "Failed to send switch request", code: "NOTIFICATION_FAILED" },
                    { status: 500 }
               );
          }

          return NextResponse.json(
               { success: false, message: "Switch request sent to room owner for approval", status: "pending" },
               { status: 200 }
          );
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Server error in switch route:", errorMessage, error);
          return NextResponse.json({ error: "Failed to switch room", details: errorMessage }, { status: 500 });
     }
}