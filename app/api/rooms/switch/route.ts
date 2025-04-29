import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const { roomId } = await req.json();

          // Check if user is authenticated
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Check if room exists
          const { data: room, error: roomError } = await supabase
               .from("rooms")
               .select("*")
               .eq("id", roomId)
               .single();
          if (roomError || !room) {
               return NextResponse.json({ error: "Room not found" }, { status: 404 });
          }

          // Check if user is a member
          const { data: membership, error: memberError } = await supabase
               .from("room_members")
               .select("*")
               .eq("room_id", roomId)
               .eq("user_id", session.user.id)
               .single();
          if (memberError || !membership) {
               return NextResponse.json({ error: "You are not a member of this room" }, { status: 403 });
          }

          // Update active status
          const { error: updateError } = await supabase
               .from("room_members")
               .update({ active: true })
               .eq("room_id", roomId)
               .eq("user_id", session.user.id);
          if (updateError) {
               console.error("Error updating room_members:", updateError);
               return NextResponse.json({ error: "Failed to switch room" }, { status: 500 });
          }

          // Set other rooms as inactive
          const { error: deactivateError } = await supabase
               .from("room_members")
               .update({ active: false })
               .eq("user_id", session.user.id)
               .neq("room_id", roomId);
          if (deactivateError) {
               console.error("Error deactivating other rooms:", deactivateError);
          }

          return NextResponse.json({ success: true, message: `Switched to ${room.name}` });
     } catch (error) {
          console.error("Server error:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
     }
}