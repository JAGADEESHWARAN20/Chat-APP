import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validateMessageText,
  validateUUID,
  withAuth,
  withRateLimit,
} from "@/lib/api-utils";
import { MESSAGE_WITH_PROFILE_SELECT } from "@/lib/queries/messages";

const DEFAULT_LIMIT = 50;

export const GET = (req: NextRequest, ctx: { params: { chatId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { chatId } = ctx.params;
      validateUUID(chatId, "chatId");

      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await withRateLimit(`dm-history-${chatId}-${ip}`);

      const { data: chat } = await supabase
        .from("direct_chats")
        .select("user_id_1, user_id_2, initiator_id, interest_status")
        .eq("id", chatId)
        .single();

      if (!chat || (chat.user_id_1 !== user.id && chat.user_id_2 !== user.id)) {
        return errorResponse("Direct chat not found", "DIRECT_CHAT_NOT_FOUND", 404);
      }

      const before = req.nextUrl.searchParams.get("before");
      const limitParam = Number(req.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT);
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : DEFAULT_LIMIT;

      let query = supabase
        .from("messages")
        .select(MESSAGE_WITH_PROFILE_SELECT)
        .eq("direct_chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt("created_at", before);
      }

      const { data: messages, error } = await query;
      if (error) {
        return errorResponse("Failed to fetch direct messages", "FETCH_DIRECT_MESSAGES_FAILED", 500);
      }

      return successResponse({ messages: messages ?? [] });
    } catch {
      return errorResponse("Invalid request", "INVALID_REQUEST", 400);
    }
  })(req);

export const POST = (req: NextRequest, ctx: { params: { chatId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { chatId } = ctx.params;
      validateUUID(chatId, "chatId");

      const { text } = await req.json();
      validateMessageText(text);

      const { data: chat } = await supabase
        .from("direct_chats")
        .select("user_id_1, user_id_2, initiator_id, interest_status")
        .eq("id", chatId)
        .single();

      if (!chat || (chat.user_id_1 !== user.id && chat.user_id_2 !== user.id)) {
        return errorResponse("Not a participant in this direct chat", "NOT_A_PARTICIPANT", 403);
      }

      if (chat.interest_status === "declined") {
        return errorResponse("Conversation request was declined", "CHAT_DECLINED", 403);
      }

      if (chat.interest_status === "pending") {
        if (chat.initiator_id !== user.id) {
          return errorResponse("Accept request before replying", "CHAT_PENDING_ACCEPTANCE", 403);
        }

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("direct_chat_id", chatId)
          .eq("sender_id", user.id);

        if ((count ?? 0) >= 1) {
          return errorResponse("Only one intro message is allowed until accepted", "INTRO_MESSAGE_LIMIT", 403);
        }
      }

      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          text: text.trim(),
          direct_chat_id: chatId,
          room_id: null,
          sender_id: user.id,
          status: "sent",
          is_edited: false,
        })
        .select(MESSAGE_WITH_PROFILE_SELECT)
        .single();

      if (error || !message) {
        return errorResponse("Failed to send message", "SEND_DIRECT_MESSAGE_FAILED", 500);
      }

      return successResponse({ message }, 201);
    } catch {
      return errorResponse("Invalid request payload", "INVALID_PAYLOAD", 400);
    }
  })(req);
