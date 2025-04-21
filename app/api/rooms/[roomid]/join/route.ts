import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
     req: NextRequest,
     { params }: { params: { roomId: string } }
) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const { roomId } = params;
     console.log(roomId)
     const userId = session.user.id;
     console.log(userId)

     // Check if room exists and if it's private
     const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("is_private, created_by")
          .eq("id", roomId)
          .single();

     if (roomError || !room) {
          return NextResponse.json({ error: "Room not found" }, { status: 404 });
     }

     // For private rooms, create pending request; otherwise, accept immediately
     const status = room.is_private && room.created_by !== userId ? "pending" : "accepted";

     const { error } = await supabase
          .from("room_participants")
          .insert({
               room_id: roomId,
               user_id: userId,
               status,
               joined_at: new Date().toISOString(),
          });

     if (error) {
          console.error("Error joining room:", error);
          return NextResponse.json({ error: "Failed to join room", details: error.message }, { status: 500 });
     }

     return NextResponse.json({ status });
}

// import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// import { cookies } from "next/headers";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(
//      req: NextRequest,
//      { params }: { params: { roomId: string } }
// ) {
//      const supabase = createRouteHandlerClient({ cookies });
//      const { data: { session } } = await supabase.auth.getSession();

//      if (!session) {
//           return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//      }

//      const { roomId } = params;
//      const userId = session.user.id;

//      // Log the request body and session data
//      const requestBody = await req.json().catch(() => ({})); // Handle empty or invalid body
//      console.log("Request body:", requestBody);
//      console.log("User ID from session:", userId);
//      console.log("Room ID from params:", roomId);

//      // Insert into room_participants table
//      const { error } = await supabase
//           .from("room_participants")
//           .insert({
//                room_id: roomId,
//                user_id: userId,
//                status: "pending", // Default status for join request
//                joined_at: new Date().toISOString(),
//           });

//      if (error) {
//           return NextResponse.json(
//                { error: "Failed to join room", details: error.message },
//                { status: 500 }
//           );
//      }

//      return NextResponse.json({ success: true, status: "pending" });
// }