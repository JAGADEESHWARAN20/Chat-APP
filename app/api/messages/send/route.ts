import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { roomId, directChatId, text } = await req.json();

    // Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // Validate input
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message text is required", code: "INVALID_TEXT" },
        { status: 400 }
      );
    }
    if (!roomId && !directChatId) {
      return NextResponse.json(
        { success: false, error: "Room ID or Direct Chat ID required", code: "INVALID_TARGET" },
        { status: 400 }
      );
    }
    if (text.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Message text too long", code: "TEXT_TOO_LONG" },
        { status: 400 }
      );
    }
    if (roomId && !UUID_REGEX.test(roomId)) {
      return NextResponse.json(
        { success: false, error: "Invalid room ID format", code: "INVALID_ROOM_ID" },
        { status: 400 }
      );
    }
    if (directChatId && !UUID_REGEX.test(directChatId)) {
      return NextResponse.json(
        { success: false, error: "Invalid direct chat ID format", code: "INVALID_DIRECT_CHAT_ID" },
        { status: 400 }
      );
    }
    

    // Verify membership/participation
    if (roomId) {
      const { data: member } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .eq("status", "accepted")
        .single();
      if (!member) {
        return NextResponse.json(
          { success: false, error: "Not a member of this room", code: "NOT_A_MEMBER" },
          { status: 403 }
        );
      }
    } else if (directChatId) {
      const { data: chat } = await supabase
        .from("direct_chats")
        .select("user_id_1, user_id_2")
        .eq("id", directChatId)
        .single();
      if (!chat || (chat.user_id_1 !== userId && chat.user_id_2 !== userId)) {
        return NextResponse.json(
          { success: false, error: "Not a participant in this direct chat", code: "NOT_A_PARTICIPANT" },
          { status: 403 }
        );
      }
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        text: text.trim(),
        room_id: roomId || null,
        direct_chat_id: directChatId || null,
        sender_id: userId,
        created_at: new Date().toISOString(),
        status: "sent",
        is_edited: false,
      })
      .select(`
        id,
        text,
        sender_id,
        created_at,
        is_edited,
        room_id,
        direct_chat_id,
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
      `)
      .single();

    if (error) {
      console.error("[messages] Insert error:", error);
      return NextResponse.json(
        { success: false, error: error.message, code: "INSERT_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    console.error("[messages] Server error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}