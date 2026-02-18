"use client";

import { useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import { useDirectChatStore, type DirectChatSummary } from "@/lib/store/directChatStore";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";

type ChatTargetUser = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

const normalizeFallbackChat = (
  chat: { id: string; user_id_1: string; user_id_2: string; created_at: string | null },
  currentUserId: string,
  target: ChatTargetUser
): DirectChatSummary => ({
  ...chat,
  created_at: chat.created_at ?? new Date().toISOString(),
  unread_count: 0,
  latest_message: null,
  latest_message_created_at: null,
  other_user: {
    id: target.id,
    username: target.username ?? null,
    display_name: target.display_name ?? target.username ?? `User ${target.id.slice(-4)}`,
    avatar_url: target.avatar_url ?? null,
  },
});

export function useDirectChatActions() {
  const { setChats, setSelectedChat } = useDirectChatStore((s) => ({
    setChats: s.setChats,
    setSelectedChat: s.setSelectedChat,
  }));

  const setSelectedRoomId = useUnifiedStore((s) => s.setSelectedRoomId);
  const setActiveTab = useUnifiedStore((s) => s.setActiveTab);
  const currentUserId = useUnifiedStore((s) => s.userId);

  const openOrCreateDirectChat = useCallback(
    async (targetUser: ChatTargetUser): Promise<boolean> => {
      if (!targetUser?.id) {
        toast.error("Invalid user selected");
        return false;
      }

      if (!currentUserId) {
        toast.error("Please sign in to start a direct chat");
        return false;
      }

      if (targetUser.id === currentUserId) {
        toast.error("You cannot start a direct chat with yourself");
        return false;
      }

      try {
        const createRes = await fetch("/api/direct-chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: targetUser.id }),
        });

        if (!createRes.ok) {
          toast.error("Failed to open direct chat");
          return false;
        }

        const createData = await createRes.json();
        const createdChat = createData?.chat as
          | { id: string; user_id_1: string; user_id_2: string; created_at: string | null }
          | undefined;

        if (!createdChat?.id) {
          toast.error("Failed to open direct chat");
          return false;
        }

        const listRes = await fetch("/api/direct-chats", { method: "GET" });
        if (listRes.ok) {
          const listData = await listRes.json();
          const chats = Array.isArray(listData?.chats)
            ? (listData.chats as DirectChatSummary[])
            : [];

          setChats(chats);
          const selected = chats.find((c) => c.id === createdChat.id);
          if (selected) {
            setSelectedRoomId(null);
            setSelectedChat(selected);
            setActiveTab("home");
            return true;
          }
        }

        setSelectedRoomId(null);
        setSelectedChat(normalizeFallbackChat(createdChat, currentUserId, targetUser));
        setActiveTab("home");
        return true;
      } catch {
        toast.error("Unable to start direct chat");
        return false;
      }
    },
    [currentUserId, setActiveTab, setChats, setSelectedChat, setSelectedRoomId]
  );

  return { openOrCreateDirectChat };
}
