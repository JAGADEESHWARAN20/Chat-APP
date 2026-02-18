import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validateUUID,
  withAuth,
} from "@/lib/api-utils";

const parsePartner = (chat: { user_id_1: string; user_id_2: string }, userId: string) =>
  chat.user_id_1 === userId ? chat.user_id_2 : chat.user_id_1;

type DirectChatRow = {
  id: string;
  user_id_1: string;
  user_id_2: string;
  initiator_id: string;
  interest_status: string | null;
  created_at: string | null;
};

export const GET = (req: NextRequest) =>
  withAuth(async ({ supabase, user }) => {
    const userId = user.id;

    const { data: chats, error } = await supabase
      .from("direct_chats")
      .select("id, user_id_1, user_id_2, initiator_id, interest_status, created_at")
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      return errorResponse("Failed to fetch direct chats", "FETCH_DIRECT_CHATS_FAILED", 500);
    }

    const safeChats: DirectChatRow[] = (chats ?? []) as DirectChatRow[];
    const partnerIds = Array.from(
      new Set(safeChats.map((chat) => parsePartner(chat, userId)).filter(Boolean))
    );

    const partnerMap = new Map<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }>();

    if (partnerIds.length > 0) {
      const { data: partners, error: partnerError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", partnerIds);

      if (partnerError) {
        return errorResponse("Failed to fetch chat participants", "FETCH_CHAT_PARTNERS_FAILED", 500);
      }

      for (const partner of partners ?? []) {
        partnerMap.set(partner.id, {
          id: partner.id,
          username: partner.username,
          display_name: partner.display_name,
          avatar_url: partner.avatar_url,
        });
      }
    }

    const summaries = await Promise.all(
      safeChats.map(async (chat) => {
        const { data: latestMessage } = await supabase
          .from("messages")
          .select("text, created_at")
          .eq("direct_chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("direct_chat_id", chat.id)
          .neq("sender_id", userId)
          .eq("status", "sent");

        const otherUserId = parsePartner(chat, userId);
        const fallbackName = `User ${otherUserId.slice(-4)}`;
        const partner =
          partnerMap.get(otherUserId) ?? {
            id: otherUserId,
            username: fallbackName,
            display_name: fallbackName,
            avatar_url: null,
          };

        return {
          ...chat,
          unread_count: count ?? 0,
          latest_message: latestMessage?.text ?? null,
          latest_message_created_at: latestMessage?.created_at ?? null,
          other_user: partner,
        };
      })
    );

    summaries.sort((a, b) => {
      const aTs = a.latest_message_created_at ? new Date(a.latest_message_created_at).getTime() : 0;
      const bTs = b.latest_message_created_at ? new Date(b.latest_message_created_at).getTime() : 0;
      return bTs - aTs;
    });

    return successResponse({ chats: summaries });
  })(req);

export const POST = (req: NextRequest) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const body = await req.json();
      const targetUserId = body?.targetUserId as string | undefined;

      if (!targetUserId) {
        return errorResponse("Target user is required", "MISSING_TARGET_USER", 400);
      }

      validateUUID(targetUserId, "targetUserId");

      if (targetUserId === user.id) {
        return errorResponse("Cannot create direct chat with yourself", "INVALID_TARGET_USER", 400);
      }

      const { data: targetUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", targetUserId)
        .maybeSingle();

      if (!targetUser) {
        return errorResponse("Target user not found", "TARGET_USER_NOT_FOUND", 404);
      }

      const [firstUserId, secondUserId] = [user.id, targetUserId].sort();

      const { data: existingChat } = await supabase
        .from("direct_chats")
        .select("id, user_id_1, user_id_2, initiator_id, interest_status, created_at")
        .eq("user_id_1", firstUserId)
        .eq("user_id_2", secondUserId)
        .maybeSingle();

      if (existingChat) {
        return successResponse({ chat: existingChat }, 200);
      }

      const { data: createdChat, error: createError } = await supabase
        .from("direct_chats")
        .insert({
          user_id_1: firstUserId,
          user_id_2: secondUserId,
          initiator_id: user.id,
          interest_status: "pending",
        })
        .select("id, user_id_1, user_id_2, initiator_id, interest_status, created_at")
        .single();

      if (createError || !createdChat) {
        return errorResponse("Failed to create direct chat", "CREATE_DIRECT_CHAT_FAILED", 500);
      }

      return successResponse({ chat: createdChat }, 201);
    } catch {
      return errorResponse("Invalid request payload", "INVALID_PAYLOAD", 400);
    }
  })(req);
