import { NextRequest } from "next/server";
import { errorResponse, successResponse, validateUUID, withAuth } from "@/lib/api-utils";

export const PATCH = (req: NextRequest, ctx: { params: { chatId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { chatId } = ctx.params;
      validateUUID(chatId, "chatId");

      const { action } = await req.json();
      if (action !== "accept" && action !== "decline") {
        return errorResponse("Invalid action", "INVALID_ACTION", 400);
      }

      const { data: chat } = await supabase
        .from("direct_chats")
        .select("id, user_id_1, user_id_2, initiator_id, interest_status")
        .eq("id", chatId)
        .single();

      if (!chat || (chat.user_id_1 !== user.id && chat.user_id_2 !== user.id)) {
        return errorResponse("Direct chat not found", "DIRECT_CHAT_NOT_FOUND", 404);
      }

      if (chat.interest_status !== "pending") {
        return errorResponse("Chat is not pending", "CHAT_NOT_PENDING", 400);
      }

      if (chat.initiator_id === user.id) {
        return errorResponse("Initiator cannot respond to own request", "INVALID_ACTOR", 403);
      }

      const nextStatus = action === "accept" ? "accepted" : "declined";

      const { data: updated, error } = await supabase
        .from("direct_chats")
        .update({ interest_status: nextStatus })
        .eq("id", chatId)
        .select("id, user_id_1, user_id_2, initiator_id, interest_status, created_at")
        .single();

      if (error || !updated) {
        return errorResponse("Failed to update chat status", "UPDATE_STATUS_FAILED", 500);
      }

      return successResponse({ chat: updated });
    } catch {
      return errorResponse("Invalid request payload", "INVALID_PAYLOAD", 400);
    }
  })(req);
