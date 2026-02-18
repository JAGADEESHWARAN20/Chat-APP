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
  chat: {
    id: string;
    user_id_1: string;
    user_id_2: string;
    initiator_id: string;
    interest_status: string | null;
    created_at: string | null;
  },
  target: ChatTargetUser
): DirectChatSummary => ({
  ...chat,
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
  const { setChats, setSelectedChat, selectedChat } = useDirectChatStore((s) => ({
    setChats: s.setChats,
    setSelectedChat: s.setSelectedChat,
    selectedChat: s.selectedChat,
  }));

  const setSelectedRoomId = useUnifiedStore((s) => s.setSelectedRoomId);
  const setActiveTab = useUnifiedStore((s) => s.setActiveTab);
  const currentUserId = useUnifiedStore((s) => s.userId);

  const refreshChats = useCallback(async () => {
    const listRes = await fetch("/api/direct-chats", { method: "GET" });
    if (!listRes.ok) return null;

    const listData = await listRes.json();
    const chats = Array.isArray(listData?.chats)
      ? (listData.chats as DirectChatSummary[])
      : [];

    setChats(chats);
    return chats;
  }, [setChats]);

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
          | {
              id: string;
              user_id_1: string;
              user_id_2: string;
              initiator_id: string;
              interest_status: string | null;
              created_at: string | null;
            }
          | undefined;

        if (!createdChat?.id) {
          toast.error("Failed to open direct chat");
          return false;
        }

        const chats = await refreshChats();
        if (chats) {
          const selected = chats.find((c) => c.id === createdChat.id);
          if (selected) {
            setSelectedRoomId(null);
            setSelectedChat(selected);
            setActiveTab("home");
            return true;
          }
        }

        setSelectedRoomId(null);
        setSelectedChat(normalizeFallbackChat(createdChat, targetUser));
        setActiveTab("home");
        return true;
      } catch {
        toast.error("Unable to start direct chat");
        return false;
      }
    },
    [currentUserId, refreshChats, setActiveTab, setSelectedChat, setSelectedRoomId]
  );

  const respondToSelectedChatRequest = useCallback(
    async (action: "accept" | "decline"): Promise<boolean> => {
      if (!selectedChat?.id) return false;

      try {
        const res = await fetch(`/api/direct-chats/${selectedChat.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!res.ok) {
          toast.error(action === "accept" ? "Failed to accept request" : "Failed to decline request");
          return false;
        }

        const chats = await refreshChats();
        if (chats) {
          const nextSelected = chats.find((chat) => chat.id === selectedChat.id) ?? null;
          setSelectedChat(nextSelected);
        }

        toast.success(action === "accept" ? "Request accepted" : "Request declined");
        return true;
      } catch {
        toast.error("Unable to update request");
        return false;
      }
    },
    [refreshChats, selectedChat?.id, setSelectedChat]
  );

  return { openOrCreateDirectChat, respondToSelectedChatRequest, refreshChats };
}
