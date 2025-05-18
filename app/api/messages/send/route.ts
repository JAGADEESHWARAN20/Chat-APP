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
      // Check room_members (for API logic)
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

      // Check room_participants (to align with RLS)
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

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        text: content,
        room_id: roomId || null,
        direct_chat_id: directChatId || null,
        sender_id: userId,
        created_at: new Date().toISOString(),
        status: "sent",
        is_edited: false,
        dm_thread_id: null,
      })
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

    // Handle notifications and real-time broadcast
    if (roomId) {
      // Fetch room details
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("name, created_by")
        .eq("id", roomId)
        .single();

      if (roomError || !room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }

      // Fetch room members to notify (excluding the sender)
      const { data: members, error: membersError } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .neq("user_id", userId);

      if (membersError) {
        console.error("Error fetching room members:", membersError);
      } else {
        // Insert notifications
        const notifications = members.map((member) => ({
          user_id: member.user_id,
          type: "new_message",
          room_id: roomId,
          direct_chat_id: null,
          sender_id: userId,
          message: `${message.users?.username || "A user"} sent a message in ${room.name}: "${content}"`,
          status: "unread",
          created_at: new Date().toISOString(),
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) {
          console.error("Error inserting notifications:", notificationError);
        }
      }

      // Broadcast real-time notification
      await supabaseServer()
        .channel(`room-${roomId}-notifications`)
        .send({
          type: "broadcast",
          event: "new-message",
          payload: { roomId, message },
        });
    } else if (directChatId) {
      // Notify the other participant in the direct chat
      const { data: directChat, error: directChatError } = await supabase
        .from("direct_chats")
        .select("user_id_1, user_id_2")
        .eq("id", directChatId)
        .single();

      if (directChatError || !directChat) {
        console.error("Error fetching direct chat:", directChatError);
      } else {
        const recipientId =
          directChat.user_id_1 === userId
            ? directChat.user_id_2
            : directChat.user_id_1;

        const notification = {
          user_id: recipientId,
          type: "new_message",
          room_id: null,
          direct_chat_id: directChatId,
          sender_id: userId,
          message: `${message.users?.username || "A user"} sent you a message: "${content}"`,
          status: "unread",
          created_at: new Date().toISOString(),
        };

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notification);

        if (notificationError) {
          console.error("Error inserting direct chat notification:", notificationError);
        }

        // Broadcast real-time notification for direct chat
        await supabaseServer()
          .channel(`direct-chat-${directChatId}-notifications`)
          .send({
            type: "broadcast",
            event: "new-message",
            payload: { directChatId, message },
          });
      }
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in messages route:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
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
