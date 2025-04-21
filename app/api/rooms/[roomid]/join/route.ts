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
    console.error("Unauthorized access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = params;
  const userId = session.user.id;

  // Log the incoming request details
  const requestBody = await req.json().catch((err) => {
    console.error("Failed to parse request body:", err);
    return { status: "pending", joined_at: new Date().toISOString() };
  });
  console.log("Received request:", {
    roomId,
    userId,
    requestBody,
  });

  const { status, joined_at } = requestBody;
  if (!["pending", "accepted", "rejected"].includes(status)) {
    console.error("Invalid status value:", status);
    return NextResponse.json(
      { error: "Invalid status value. Use 'pending', 'accepted', or 'rejected'" },
      { status: 400 }
    );
  }

  // Validate room existence
  const { data: roomExists } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .single();
  if (!roomExists) {
    console.error("Room not found:", roomId);
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Insert into room_participants
  const { error } = await supabase
    .from("room_participants")
    .insert({
      room_id: roomId,
      user_id: userId,
      status: status,
      joined_at: joined_at || new Date().toISOString(),
    });

  if (error) {
    console.error("Insert error:", error.message, error.details);
    return NextResponse.json(
      { error: "Failed to join room", details: error.message },
      { status: 500 }
    );
  }

  console.log("Successfully inserted:", { roomId, userId, status });
  return NextResponse.json({ success: true, status: status });
}