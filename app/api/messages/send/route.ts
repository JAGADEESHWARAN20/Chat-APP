import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { content, roomId } = await req.json();

    // Validate session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if the user is a member of the room
    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "You are not a member of this room" }, { status: 403 });
    }

    // Insert the message with user details
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        text: content,
        room_id: roomId,
        sender_id: userId,
        created_at: new Date().toISOString(),
        status: "sent",
        is_edited: false,
        direct_chat_id: null,
        dm_thread_id: null
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
      console.error("Error inserting message:", messageError);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Get all room members except the sender
    const { data: roomMembers, error: membersError } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .neq("user_id", userId);

    if (!membersError && roomMembers) {
      // Create notifications for all room members
      const notifications = roomMembers.map((member) => ({
        user_id: member.user_id,
        sender_id: userId,
        room_id: roomId,
        type: "message",
        message: content,
        status: "unread"
      }));

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Error creating notifications:", notificationError);
        // Don't fail the request if notifications fail
      }
    }

    // Broadcast real-time notification
    await supabaseServer()
      .channel(`room-${roomId}-notifications`)
      .send({
        type: "broadcast",
        event: "new-message",
        payload: {
          roomId,
          message: {
            ...message,
            content // Include both 'text' and 'content' for backward compatibility
          }
        },
      });

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        content // Include both 'text' and 'content' for backward compatibility
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in messages route:", errorMessage, error);
    return NextResponse.json({
      error: "Failed to send message",
      details: errorMessage
    }, { status: 500 });
  }
}