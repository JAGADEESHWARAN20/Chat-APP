// import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// import { cookies } from "next/headers";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(
//   req: NextRequest,
//   { params }: { params: { roomId: string } }
// ) {
//   try {
//     const supabase = createRouteHandlerClient({ cookies });
//     const roomId = params.roomId;

//     // Check if user is authenticated
//     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
//     if (sessionError || !session) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const userId = session.user.id;

//     // Check if room exists
//     const { data: room, error: roomError } = await supabase
//       .from("rooms")
//       .select("*, created_by")
//       .eq("id", roomId)
//       .single();
//     if (roomError || !room) {
//       return NextResponse.json({ error: "Room not found" }, { status: 404 });
//     }

//     // Check if user is already a participant
//     const { data: existingParticipant, error: participantError } = await supabase
//       .from("room_participants")
//       .select("status")
//       .eq("room_id", roomId)
//       .eq("user_id", userId)
//       .single();
//     if (participantError && participantError.code !== "PGRST116") {
//       console.error("Error checking participant status:", participantError);
//       return NextResponse.json({ error: "Failed to check membership status" }, { status: 500 });
//     }
//     if (existingParticipant) {
//       return NextResponse.json(
//         { error: "Already a member or request pending", status: existingParticipant.status },
//         { status: 400 }
//       );
//     }

//     // Add user to room_participants
//     const status = room.is_private ? "pending" : "accepted";
//     const joinedAt = room.is_private ? null : new Date().toISOString(); // Set joined_at only for accepted status
//     const { data: participant, error: insertParticipantError } = await supabase
//       .from("room_participants")
//       .insert([
//         {
//           room_id: roomId,
//           user_id: userId,
//           status,
//           joined_at: joinedAt,
//         },
//       ])
//       .select()
//       .single();
//     if (insertParticipantError) {
//       console.error("Error joining room in room_participants:", insertParticipantError);
//       return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
//     }

//     // If the room is public, add to room_members immediately
//     if (!room.is_private) {
//       const { error: membershipError } = await supabase
//         .from("room_members")
//         .upsert(
//           [
//             {
//               room_id: roomId,
//               user_id: userId,
//               active: true,
//             },
//           ],
//           { onConflict: "room_id,user_id" }
//         );
//       if (membershipError) {
//         console.error("Error adding to room_members:", membershipError);
//         return NextResponse.json({ error: "Failed to add to room_members" }, { status: 500 });
//       }

//       return NextResponse.json({
//         success: true,
//         status: "accepted",
//         message: "Joined room successfully",
//       });
//     }

//     // If the room is private, send a notification to the creator
//     const { data: creator, error: creatorError } = await supabase
//       .from("users")
//       .select("username")
//       .eq("id", userId)
//       .single();
//     if (creatorError) {
//       console.error("Error fetching user:", creatorError);
//       return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
//     }

//     const message = `${creator?.username || "A user"} requested to join ${room.name}`;
//     const { error: notificationError } = await supabase
//       .from("notifications")
//       .insert([
//         {
//           user_id: room.created_by,
//           type: "join_request",
//           room_id: roomId,
//           sender_id: userId,
//           message,
//           status: "unread",
//           created_at: new Date().toISOString(),
//         },
//       ]);
//     if (notificationError) {
//       console.error("Error sending notification:", notificationError);
//       // Roll back the room_participants entry since the notification failed
//       await supabase
//         .from("room_participants")
//         .delete()
//         .eq("room_id", roomId)
//         .eq("user_id", userId);
//       return NextResponse.json({ error: "Failed to send join request notification" }, { status: 500 });
//     }

//     return NextResponse.json({
//       success: true,
//       status: "pending",
//       message: "Join request sent",
//     });
//   } catch (error) {
//     console.error("Server error in join route:", error);
//     return NextResponse.json(
//       { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
//       { status: 500 }
//     );
//   }
// }

// route: /api/rooms/join/[roomId]/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const roomId = params.roomId;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*, created_by, is_private")
      .eq("id", roomId)
      .single();
    if (roomError || !room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const { data: existingParticipant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (participantError)
      return NextResponse.json({ error: "Error checking participant status" }, { status: 500 });

    if (existingParticipant)
      return NextResponse.json(
        { error: "Already a member or request pending", status: existingParticipant.status },
        { status: 400 }
      );

    const status = room.is_private ? "pending" : "accepted";
    const joinedAt = room.is_private ? null : new Date().toISOString();

    const { error: insertParticipantError } = await supabase
      .from("room_participants")
      .insert([
        {
          room_id: roomId,
          user_id: userId,
          status,
          joined_at: joinedAt,
        },
      ]);
    if (insertParticipantError)
      return NextResponse.json({ error: "Failed to join room" }, { status: 500 });

    if (!room.is_private) {
      const { error: membershipError } = await supabase
        .from("room_members")
        .upsert(
          [{ room_id: roomId, user_id: userId, active: true }],
          { onConflict: "room_id,user_id" }
        );
      if (membershipError)
        return NextResponse.json({ error: "Failed to add to room_members" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: room.is_private ? "Join request sent" : "Joined room successfully",
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
