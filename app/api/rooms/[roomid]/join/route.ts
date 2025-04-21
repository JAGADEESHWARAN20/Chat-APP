import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          console.error("Unauthorized access attempt");
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const { roomId } = params;
     const userId = session.user.id;

     let requestBody;
     try {
          requestBody = await req.json();
     } catch (err) {
          console.error("Failed to parse request body:", err);
          requestBody = { status: "pending", joined_at: new Date().toISOString() };
     }
     const { status, joined_at } = requestBody;
     console.log("Received request:", { roomId, userId, requestBody });

     if (!["pending", "accepted", "rejected"].includes(status)) {
          console.error("Invalid status value:", status);
          return NextResponse.json(
               { error: "Invalid status value. Use 'pending', 'accepted', or 'rejected'" },
               { status: 400 }
          );
     }

     const { data: roomExists, error: roomError } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", roomId)
          .single();

     if (roomError || !roomExists) {
          console.error("Room lookup failed:", { roomId, error: roomError?.message });
          return NextResponse.json({ error: "Room not found" }, { status: 404 });
     }

     const { error: insertError } = await supabase
          .from("room_participants")
          .insert({
               room_id: roomId,
               user_id: userId,
               status,
               joined_at: joined_at || new Date().toISOString(),
          });

     if (insertError) {
          console.error("Insert error:", { message: insertError.message, details: insertError.details });
          return NextResponse.json(
               { error: "Failed to join room", details: insertError.message },
               { status: 500 }
          );
     }

     console.log("Successfully joined room:", { roomId, userId, status });
     return NextResponse.json({ success: true, status, message: "Joined room successfully" });
}