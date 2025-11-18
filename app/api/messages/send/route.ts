// app/api/messages/send/route.ts
import { NextRequest } from "next/server";
import {
  withAuth,
  successResponse,
  errorResponse,
  validateUUID,
  validateMessageText,
  withRateLimit,
} from "@/lib/api-utils";

// ⛔ DO NOT export async function POST()
// ⛔ DO NOT return withAuth()

// ✅ Correct: POST receives req, passes ONLY (supabase, user) to handler
export const POST = (req: NextRequest) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { roomId, directChatId, text } = await req.json();

      // Rate limit by IP
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await withRateLimit(`send-message-${ip}`);

      // Validate text
      try {
        validateMessageText(text);
      } catch (err: any) {
        return errorResponse(
          err?.message || "Invalid message text",
          "INVALID_TEXT",
          400
        );
      }

      if (!roomId && !directChatId) {
        return errorResponse(
          "Room ID or Direct Chat ID required",
          "INVALID_TARGET",
          400
        );
      }

      // Validate IDs
      if (roomId) {
        try {
          validateUUID(roomId, "roomId");
        } catch {
          return errorResponse("Invalid room ID", "INVALID_ROOM_ID", 400);
        }
      }

      if (directChatId) {
        try {
          validateUUID(directChatId, "directChatId");
        } catch {
          return errorResponse(
            "Invalid direct chat ID",
            "INVALID_DIRECT_CHAT_ID",
            400
          );
        }
      }

      const userId = user.id;

      // Membership check
      if (roomId) {
        const { data: member } = await supabase
          .from("room_members")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .eq("status", "accepted")
          .single();

        if (!member) {
          return errorResponse(
            "Not a member of this room",
            "NOT_A_MEMBER",
            403
          );
        }
      } else if (directChatId) {
        const { data: chat } = await supabase
          .from("direct_chats")
          .select("user_id_1, user_id_2")
          .eq("id", directChatId)
          .single();

        if (
          !chat ||
          (chat.user_id_1 !== userId && chat.user_id_2 !== userId)
        ) {
          return errorResponse(
            "Not a participant in this direct chat",
            "NOT_A_PARTICIPANT",
            403
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
        .select(
          `
          id,
          text,
          sender_id,
          created_at,
          is_edited,
          room_id,
          direct_chat_id,
          status,
          profiles:profiles!messages_sender_id_fkey(
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
        .single();

      if (error) {
        console.error("Insert error:", error);
        return errorResponse(
          "Failed to send message",
          "INSERT_FAILED",
          500
        );
      }

      return successResponse({ success: true, message });
    } catch (err) {
      console.error("Message send error:", err);
      return errorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
    }
  })(req); // IMPORTANT: pass req HERE
