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

  const { roomId } = params; // Current room ID from URL
  const requestBody = await req.json();
  const { userId, status, joined_at } = requestBody;

  // Validate inputs
  if (!roomId || roomId === "undefined") {
    console.error("Missing or invalid roomId:", roomId);
    return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
  }
  if (!userId || userId === "undefined") {
    console.error("Missing or invalid userId:", userId);
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }
  if (!["pending", "accepted", "rejected"].includes(status)) {
    console.error("Invalid status value:", status);
    return NextResponse.json(
      { error: "Invalid status value. Use 'pending', 'accepted', or 'rejected'" },
      { status: 400 }
    );
  }

  // Check if user is already a participant
  const { data: existingParticipation } = await supabase
    .from("room_participants")
    .select("status")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single();

  if (existingParticipation && existingParticipation.status === "accepted") {
    return NextResponse.json({ error: "You are already a member of this room" }, { status: 400 });
  }

  // Log for debugging
  console.log("Received request:", { roomId, userId, status, joined_at });

  // Check if room exists (subject to RLS)
  const { data: roomExists, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .single();

  if (roomError || !roomExists) {
    console.error("Room lookup failed:", { roomId, error: roomError?.message });
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Insert participant record
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