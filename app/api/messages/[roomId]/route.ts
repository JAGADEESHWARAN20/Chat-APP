import { NextRequest } from "next/server";
import {
  withAuth,
  validateUUID,
  errorResponse,
  successResponse,
  withRateLimit,
} from "@/lib/api-utils";

export const GET = (req: NextRequest, ctx: { params: { roomId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const roomId = ctx.params.roomId;

      if (!roomId) {
        return errorResponse("Room ID missing", "MISSING_ROOM_ID", 400);
      }

      validateUUID(roomId, "roomId");

      // Rate limit by room + IP
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await withRateLimit(`messages-${roomId}-${ip}`);

      // Check room exists
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, is_private, created_by")
        .eq("id", roomId)
        .single();

      if (roomError || !room) {
        return errorResponse("Room not found", "ROOM_NOT_FOUND", 404);
      }

      // Private room access check
      if (room.is_private) {
        const { data: member } = await supabase
          .from("room_members")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .eq("status", "accepted")
          .single();

        if (!member) {
          return errorResponse(
            "Access denied to private room",
            "ACCESS_DENIED",
            403
          );
        }
      }

      // Fetch latest messages
      const { data: messages, error: msgError } = await supabase
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
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (msgError) {
        return errorResponse(
          "Failed to fetch messages",
          "FETCH_ERROR",
          500
        );
      }

      return successResponse({ messages });
    } catch (error) {
      console.error("GET /messages error:", error);
      return errorResponse(
        "Internal server error",
        "INTERNAL_ERROR",
        500
      );
    }
  })(req);
