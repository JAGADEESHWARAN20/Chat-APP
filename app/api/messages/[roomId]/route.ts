import { NextRequest } from "next/server";
import { withAuth, validateUUID, errorResponse, successResponse, withRateLimit } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } } // ✅ FIXED
) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { roomId } = params; // ✅ No need to await

      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      await withRateLimit(`messages-${roomId}-${ip}`);

      validateUUID(roomId, "roomId");

      const { data: room } = await supabase
        .from("rooms")
        .select("id, is_private, created_by")
        .eq("id", roomId)
        .single();

      if (!room) {
        return errorResponse("Room not found", "ROOM_NOT_FOUND", 404);
      }

      if (room.is_private) {
        const { data: member } = await supabase
          .from("room_members")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .eq("status", "accepted")
          .single();

        if (!member) {
          return errorResponse("Access denied to private room", "ACCESS_DENIED", 403);
        }
      }

      const { data: messages, error } = await supabase
        .from("messages")
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
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        return errorResponse("Failed to fetch messages", "FETCH_ERROR", 500);
      }

      return successResponse({ messages });
    } catch (error) {
      console.error("Server error:", error);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  });
}
