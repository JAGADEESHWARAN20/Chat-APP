import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { roomId } = await params;

    // Validate roomId
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "Valid roomId is required" }, { status: 400 });
    }

    // Check if user is authenticated
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to the room
    const { data: roomAccess, error: accessError } = await supabase
      .from("room_participants")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (accessError || !roomAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // ✅ Fetch messages with related profiles (sender info)
    const { data: messages, error: fetchError } = await supabase
      .from("messages")
      .select(
        `
        id,
        text,
        sender_id,
        created_at,
        is_edited,
        room_id,
        direct_chat_id,
        dm_thread_id,
        status,
        profiles:profiles!messages_sender_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          created_at,
          updated_at,
          bio
        )
      `
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // Ensure messages is always an array
    const safeMessages = Array.isArray(messages) ? messages : [];
    
    return NextResponse.json({ messages: safeMessages });
  } catch (error) {
    console.error("Server error in message fetch route:", error);
    return NextResponse.json(
      { error: "Internal server error", messages: [] },
      { status: 500 }
    );
  }
}
