import { NextRequest } from "next/server";
import { withAuth, validateUUID, errorResponse, successResponse } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { roomId } = await params;

      // Validate roomId
      if (!roomId) {
        return errorResponse("Valid roomId is required", "INVALID_ROOM_ID", 400);
      }
      validateUUID(roomId, "roomId");

      // Check if user has access to the room
      const { data: roomAccess, error: accessError } = await supabase
        .from("room_members") // Fixed: using room_members instead of room_participants
        .select("user_id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .single();

      if (accessError || !roomAccess) {
        return errorResponse("Access denied", "ACCESS_DENIED", 403);
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

      return successResponse({ messages: messages || [] });
    } catch (error) {
      console.error("Server error in message fetch route:", error);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  });
}