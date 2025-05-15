import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const roomId = params.roomId;

    // Validate roomId
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "Valid roomId is required" }, { status: 400 });
    }

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to the room
    const { data: roomAccess, error: accessError } = await supabase
      .from("room_participants")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .single();

    if (accessError || !roomAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch messages for the specific room
    const { data: messages, error: fetchError } = await supabase
      .from("messages")
      .select(`
        id,
        text,
        sender_id,
        created_at,
        is_edited,
        room_id,
        direct_chat_id,
        dm_thread_id,
        status,
        users:users!sender_id (
          id,
          username,
          display_name,
          avatar_url,
          created_at
        )
      `)
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Server error in message fetch route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}