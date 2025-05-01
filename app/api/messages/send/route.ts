import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { roomId, message } = await req.json();

    // Validate session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate room existence
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Insert the message into the messages table
    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert([
        {
          room_id: roomId,
          user_id: session.user.id,
          content: message,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (messageError) {
      console.error("Error sending message:", messageError);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Fetch sender's username
    const { data: sender, error: senderError } = await supabase
      .from("users")
      .select("username")
      .eq("id", session.user.id)
      .single();
    if (senderError) {
      console.error("Error fetching sender:", senderError);
    }

    // Broadcast notification to all users
    const notification = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      type: "new_message",
      room_id: roomId,
      sender_id: session.user.id,
      message: `${sender?.username || "A user"} sent a message in ${room.name}: "${message}"`,
      status: "unread",
      created_at: new Date().toISOString(),
    };

    await supabaseServer()
      .channel("global-notifications")
      .send({
        type: "broadcast",
        event: "new-message",
        payload: notification,
      });

    return NextResponse.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in message send route:", errorMessage, error);
    return NextResponse.json({ error: "Failed to send message", details: errorMessage }, { status: 500 });
  }
}