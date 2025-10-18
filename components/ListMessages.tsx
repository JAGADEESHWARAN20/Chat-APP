// components/ListMessages.tsx - FIXED RESPONSIVE VERSION
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
  const { selectedRoom } = state;
  const user = useUser((state) => state.user);

  const {
    messages,
    setMessages,
    addMessage,
    optimisticIds,
    optimisticDeleteMessage,
    optimisticUpdateMessage,
  } = useMessage((state) => state);
  const supabase = supabaseBrowser();

  const handleOnScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollContainer = scrollRef.current;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop <= clientHeight + 10;
    setUserScrolled(!isNearBottom);

    if (isNearBottom) {
      setNotification(0);
    }
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
      setMessages([]);
      return;
    }

    let isMounted = true;

    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/messages/${selectedRoom.id}`);
        if (!res.ok) {
          throw new Error(await res.text());
        }

        const { messages: fetchedMessages } = await res.json();
        if (fetchedMessages && Array.isArray(fetchedMessages)) {
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
          if (isMounted) {
            setMessages(formattedMessages);
          }
        } else if (isMounted) {
          console.warn("No messages or invalid messages format received");
          setMessages([]);
        }
      } catch (error) {
        if (isMounted) {
          toast.error("Failed to load messages");
          console.error(error);
          setMessages([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [selectedRoom?.id, setMessages]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!selectedRoom?.id) return;

    const messageChannel = supabase
      .channel(`room_messages_${selectedRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        (payload) => {
          try {
            const messagePayload = payload.new as MessageRow | null;
            if (!messagePayload || messagePayload.room_id !== selectedRoom.id) {
              return;
            }

            if (payload.eventType === "INSERT") {
              if (optimisticIds.includes(messagePayload.id)) {
                return;
              }

              supabase
                .from("profiles")
                .select("*")
                .eq("id", messagePayload.sender_id)
                .single<ProfileRow>()
                .then(({ data: profile, error }) => {
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  if (!profile) return;

                  if (messages.some((m) => m.id === messagePayload.id)) {
                    return;
                  }

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
                      scrollRef.current.scrollHeight -
                        scrollRef.current.clientHeight -
                        10
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
            toast.error("Error processing real-time message update");
            console.error(err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [
    selectedRoom?.id,
    optimisticIds,
    addMessage,
    optimisticUpdateMessage,
    optimisticDeleteMessage,
    supabase,
    messages,
  ]);

  // Auto-scroll when new messages arrive
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

  // Memoized filtered and sorted messages
  const filteredMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages) || !selectedRoom?.id) {
      return [];
    }
    return messages
      .filter((msg): msg is Imessage => msg && msg.room_id === selectedRoom.id)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [messages, selectedRoom?.id]);

  const SkeletonMessage = React.memo(() => (
    <div className="flex gap-2 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-700" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-700 rounded w-1/4" />
        <div className="h-3 bg-gray-700 rounded w-3/4" />
      </div>
    </div>
  ));

  SkeletonMessage.displayName = "SkeletonMessage";

  if (!selectedRoom?.id) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Messages Scroll Area */}
      <div
        id="message-container"
        tabIndex={0}
        role="region"
        aria-label="Messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0 w-full scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
        ref={scrollRef}
        onScroll={handleOnScroll}
      >
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
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}

        {/* Portaled dialogs */}
        <DeleteAlert />
        <EditAlert />
      </div>

      {/* Typing Indicator - Between messages and input */}
      {user?.id && selectedRoom?.id && (
        <TypingIndicator 
          roomId={selectedRoom.id} 
          currentUserId={user.id} 
        />
      )}

      {/* Scroll to bottom button */}
      {userScrolled && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-10">
          {notification > 0 ? (
            <button
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md text-sm transition-colors shadow-lg"
              onClick={scrollDown}
              aria-label={`Scroll to view ${notification} new messages`}
            >
              New {notification} messages
            </button>
          ) : (
            <button
              className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex justify-center items-center transition-all hover:scale-110 shadow-lg"
              onClick={scrollDown}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}