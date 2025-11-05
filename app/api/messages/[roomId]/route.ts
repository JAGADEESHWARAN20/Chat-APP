// app/api/messages/[roomId]/route.ts
import { NextRequest } from "next/server";
import { withAuth, validateUUID, errorResponse, successResponse, withRateLimit } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { roomId } = await params;
      
      // Rate limiting
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      await withRateLimit(`messages-${roomId}-${ip}`);
      
      // Validate roomId
      try {
        validateUUID(roomId, "roomId");
      } catch (error) {
        return errorResponse("Valid roomId is required", "INVALID_ROOM_ID", 400);
      }

      // Check if room exists and user has access
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, is_private, created_by")
        .eq("id", roomId)
        .single();

      if (roomError || !room) {
        return errorResponse("Room not found", "ROOM_NOT_FOUND", 404);
      }

      // For private rooms, check membership
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

      // Fetch messages with related profiles
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

      if (fetchError) {
        console.error("Error fetching messages:", fetchError);
        return errorResponse("Failed to fetch messages", "FETCH_ERROR", 500);
      }

      return successResponse({
        messages: Array.isArray(messages) ? messages : []
      });
    } catch (error) {
      console.error("Server error in message fetch route:", error);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  });
}