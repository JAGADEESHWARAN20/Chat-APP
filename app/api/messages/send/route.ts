import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, validateUUID, errorResponse, successResponse } from "@/lib/api-utils";

const sendMessageSchema = z.object({
  roomId: z.string().uuid().optional(),
  directChatId: z.string().uuid().optional(),
  text: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const body = sendMessageSchema.parse(await req.json());
      const { roomId, directChatId, text } = body;

      // Validate that either roomId or directChatId is provided
      if (!roomId && !directChatId) {
        return errorResponse("Room ID or Direct Chat ID required", "INVALID_TARGET", 400);
      }

      // Verify membership/participation
      if (roomId) {
        validateUUID(roomId, "roomId");
        const { data: member } = await supabase
          .from("room_members")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .eq("status", "accepted")
          .single();

        if (!member) {
          return errorResponse("Not a member of this room", "NOT_A_MEMBER", 403);
        }
      } else if (directChatId) {
        validateUUID(directChatId, "directChatId");
        const { data: chat } = await supabase
          .from("direct_chats")
          .select("user_id_1, user_id_2")
          .eq("id", directChatId)
          .single();

        if (!chat || (chat.user_id_1 !== user.id && chat.user_id_2 !== user.id)) {
          return errorResponse("Not a participant in this direct chat", "NOT_A_PARTICIPANT", 403);
        }
      }

      // Insert message using RPC for better consistency
      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          text: text.trim(),
          room_id: roomId || null,
          direct_chat_id: directChatId || null,
          sender_id: user.id,
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
        return errorResponse("Failed to send message", "INSERT_FAILED", 500);
      }

      return successResponse({ message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse("Invalid input data", "VALIDATION_ERROR", 400);
      }
      console.error("[messages] Server error:", error);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  });
}