// components/ListMessages.tsx - FIXED: Null guard for selectedRoom.id in handleRealtimePayload
"use client";

import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { useRoomContext } from "@/lib/store/RoomContext";
import TypingIndicator from "./TypingIndicator";
import { useUser } from "@/lib/store/user";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default function ListMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [notification, setNotification] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const { state } = useRoomContext();
  const { selectedRoom, user: contextUser } = state;
  const storeUser = useUser((state) => state.user);
  const user = contextUser ?? storeUser;

  const {
    messages,
    setMessages,
    addMessage,
    optimisticIds,
    optimisticDeleteMessage,
    optimisticUpdateMessage,
  } = useMessage((state) => state);

  const supabase = supabaseBrowser();

  console.log("[ListMessages] Render:", {
    messageCount: messages.length,
    hasRoom: !!selectedRoom?.id,
    hasUser: !!user?.id,
    userFrom: contextUser ? "RoomContext" : "UserStore",
  });

  const handleOnScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const scrollContainer = scrollRef.current;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop <= clientHeight + 10;

    setUserScrolled(!isNearBottom);
    if (isNearBottom) setNotification(0);
  }, []);

  const scrollDown = useCallback(() => {
    setNotification(0);
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    scrollRef.current?.focus();
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!selectedRoom?.id) {
      console.log("[ListMessages] No room selected, clearing messages");
      setMessages([]);
      return;
    }

    let isMounted = true;

    const loadInitialMessages = async () => {
      setIsLoading(true);
      console.log("[ListMessages] 📥 Loading initial messages for room:", selectedRoom.id);

      try {
        const res = await fetch(`/api/messages/${selectedRoom.id}`);
        if (!res.ok) throw new Error(await res.text());

        const { messages: fetchedMessages } = await res.json();

        if (fetchedMessages && Array.isArray(fetchedMessages)) {
          console.log(`[ListMessages] ✅ Loaded ${fetchedMessages.length} messages`);
          const formattedMessages = fetchedMessages.map((msg: any) => ({
            ...msg,
            profiles: msg.profiles
              ? {
                  id: msg.profiles.id,
                  avatar_url: msg.profiles.avatar_url ?? null,
                  display_name: msg.profiles.display_name ?? null,
                  username: msg.profiles.username ?? null,
                  created_at: msg.profiles.created_at ?? null,
                  bio: msg.profiles.bio ?? null,
                  updated_at: msg.profiles.updated_at ?? null,
                }
              : null,
          }));

          if (isMounted) setMessages(formattedMessages);
        } else if (isMounted) {
          console.warn("[ListMessages] No messages or invalid format");
          setMessages([]);
        }
      } catch (error) {
        if (isMounted) {
          console.error("[ListMessages] Error loading messages:", error);
          toast.error("Failed to load messages");
          setMessages([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [selectedRoom?.id, setMessages]);

  // Memoized realtime handler
  const handleRealtimePayload = useCallback(
    (payload: any) => {
      try {
        const messagePayload = payload.new as MessageRow | null;

        // FIXED: Null check for selectedRoom
        if (!messagePayload || !selectedRoom || messagePayload.room_id !== selectedRoom.id) return;

        if (payload.eventType === "INSERT") {
          if (optimisticIds.includes(messagePayload.id)) return;

          supabase
            .from("profiles")
            .select("*")
            .eq("id", messagePayload.sender_id)
            .single<ProfileRow>()
            .then(({ data: profile, error }) => {
              if (error || !profile) return;

              if (messages.some((m) => m.id === messagePayload.id)) return;

              const newMessage: Imessage = {
                id: messagePayload.id,
                created_at: messagePayload.created_at,
                is_edited: messagePayload.is_edited,
                sender_id: messagePayload.sender_id,
                room_id: messagePayload.room_id,
                direct_chat_id: messagePayload.direct_chat_id,
                dm_thread_id: messagePayload.dm_thread_id,
                status: messagePayload.status,
                text: messagePayload.text,
                profiles: {
                  id: profile.id,
                  avatar_url: profile.avatar_url ?? null,
                  display_name: profile.display_name ?? null,
                  username: profile.username ?? null,
                  created_at: profile.created_at ?? null,
                  bio: profile.bio ?? null,
                  updated_at: profile.updated_at ?? null,
                },
              };

              addMessage(newMessage);

              if (
                scrollRef.current &&
                scrollRef.current.scrollTop <
                  scrollRef.current.scrollHeight - scrollRef.current.clientHeight - 10
              ) {
                setNotification((prev) => prev + 1);
              }
            });
        } else if (payload.eventType === "UPDATE") {
          const oldMessage = messages.find((m) => m.id === messagePayload.id);
          if (oldMessage) {
            optimisticUpdateMessage(messagePayload.id, {
              ...oldMessage,
              text: messagePayload.text,
              is_edited: messagePayload.is_edited,
            });
          }
        } else if (payload.eventType === "DELETE") {
          optimisticDeleteMessage((payload.old as MessageRow).id);
        }
      } catch (err) {
        console.error("[ListMessages] Realtime error:", err);
        toast.error("Error processing message update");
      }
    },
    [selectedRoom, optimisticIds, supabase, messages, addMessage, optimisticUpdateMessage, optimisticDeleteMessage]
  );

  // Real-time subscription
  useEffect(() => {
    if (!selectedRoom?.id) return;

    const messageChannel = supabase.channel(`room_messages_${selectedRoom.id}`);

    messageChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        handleRealtimePayload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [selectedRoom?.id, supabase, handleRealtimePayload]);

  // Auto-scroll
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (
      scrollRef.current &&
      !userScrolled &&
      prevMessagesLength.current < messages.length
    ) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, userScrolled]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages) || !selectedRoom?.id) return [];
    return messages
      .filter((msg): msg is Imessage => msg && msg.room_id === selectedRoom.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selectedRoom?.id]);

  const SkeletonMessage = React.memo(() => (
    <div className="flex gap-2 animate-pulse w-full">
      <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-4 bg-gray-700 rounded w-1/4" />
        <div className="h-3 bg-gray-700 rounded w-3/4 break-all" />
      </div>
    </div>
  ));

  SkeletonMessage.displayName = "SkeletonMessage";

  if (!selectedRoom?.id) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 overflow-hidden">
        <p>Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[85vh] min-h-0 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleOnScroll}
        className="flex-1 overflow-y-scroll h-[80vh] overflow-x-hidden px-4 py-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
        style={{ maxWidth: "100%" }}
      >
        <div className="w-full max-w-full">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }, (_, index) => (
                <SkeletonMessage key={index} />
              ))}
            </div>
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map((message) => (
              <Message key={message.id} message={message} />
            ))
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <p>No messages yet. Start a conversation!</p>
            </div>
          )}
        </div>
        <div className="pb-12" />
      </div>

      <div className="flex-shrink-0 sticky bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <TypingIndicator />
      </div>

      <DeleteAlert />
      <EditAlert />
    </div>
  );
}