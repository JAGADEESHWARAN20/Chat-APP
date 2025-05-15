import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { text, room_id, direct_chat_id } = await req.json();

    // Validate session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate that either room_id or direct_chat_id is provided
    if (!room_id && !direct_chat_id) {
      return NextResponse.json({ error: "Either room_id or direct_chat_id is required" }, { status: 400 });
    }

    // Create the message
    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        text,
        sender_id: session.user.id,
        room_id: room_id || null,
        direct_chat_id: direct_chat_id || null,
        dm_thread_id: null,
        is_edited: false,
        status: "sent",
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        users:users!sender_id (
          id,
          username,
          display_name,
          avatar_url,
          created_at
        )
      `)
      .single();

    if (messageError) {
      console.error("Error sending message:", messageError);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Broadcast notification if it's a room message
    if (room_id) {
      const { data: room } = await supabase
        .from("rooms")
        .select("name")
        .eq("id", room_id)
        .single();

      const notification = {
        id: crypto.randomUUID(),
        user_id: session.user.id,
        type: "new_message",
        room_id,
        sender_id: session.user.id,
        message: `${newMessage.users?.username || "A user"} sent a message in ${room?.name || "a room"}`,
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
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error("Server error in message send route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}