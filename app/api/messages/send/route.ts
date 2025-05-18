import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { content, roomId, directChatId } = await req.json();

    // Validate input
    if (!content || (!roomId && !directChatId)) {
      return NextResponse.json(
        { error: "Content and either roomId or directChatId are required" },
        { status: 400 }
      );
    }
    if (roomId && directChatId) {
      return NextResponse.json(
        { error: "Cannot specify both roomId and directChatId" },
        { status: 400 }
      );
    }

    // Validate session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Validate membership or direct chat participation
    if (roomId) {
      const { data: membership, error: membershipError } = await supabase
        .from("room_members")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (membershipError || !membership) {
        return NextResponse.json(
          { error: "You are not a member of this room" },
          { status: 403 }
        );
      }

      const { data: participant, error: participantError } = await supabase
        .from("room_participants")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .eq("status", "accepted")
        .single();

      if (participantError || !participant) {
        return NextResponse.json(
          { error: "You are not an accepted participant in this room" },
          { status: 403 }
        );
      }
    } else if (directChatId) {
      const { data: directChat, error: directChatError } = await supabase
        .from("direct_chats")
        .select("*")
        .eq("id", directChatId)
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .single();

      if (directChatError || !directChat) {
        return NextResponse.json(
          { error: "You are not a participant in this direct chat" },
          { status: 403 }
        );
      }
    }

    // Log the message payload before insert
    const messagePayload = {
      text: content,
      room_id: roomId || null,
      direct_chat_id: directChatId || null,
      sender_id: userId,
      created_at: new Date().toISOString(),
      status: "sent",
      is_edited: false,
      dm_thread_id: null,
    };
    console.log("Inserting message with payload:", messagePayload);

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert(messagePayload)
      .select(
        `
        *,
        users:sender_id (
          id,
          username,
          display_name,
          avatar_url,
          created_at
        )
      `
      )
      .single();

    if (messageError) {
      console.error("Error sending message:", {
        message: messageError.message,
        details: messageError.details,
        hint: messageError.hint,
        code: messageError.code,
        requestBody: { content, roomId, directChatId, userId },
        messagePayload,
      });
      return NextResponse.json(
        {
          error: "Failed to send message",
          details: messageError.message,
          supabaseCode: messageError.code,
        },
        { status: 500 }
      );
    }

    // Real-time broadcast (notifications are now handled by the trigger)
    if (roomId) {
      await supabaseServer()
        .channel(`room-${roomId}-notifications`)
        .send({
          type: "broadcast",
          event: "new-message",
          payload: { roomId, message },
        });
    } else if (directChatId) {
      await supabaseServer()
        .channel(`direct-chat-${directChatId}-notifications`)
        .send({
          type: "broadcast",
          event: "new-message",
          payload: { directChatId, message },
        });
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in messages route:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: await req.json().catch(() => ({})),
    });
    return NextResponse.json(
      {
        error: "Failed to send message",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
