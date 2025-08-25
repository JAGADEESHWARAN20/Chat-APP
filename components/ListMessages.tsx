"use client";

import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";

import { Database } from "@/lib/types/supabase";
import { useRoomStore } from "@/lib/store/roomstore";
import TypingIndicator from "./TypingIndicator";
import { useUser } from "@/lib/store/user";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default function ListMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [notification, setNotification] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
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
    const isScroll =
      scrollContainer.scrollTop <
      scrollContainer.scrollHeight - scrollContainer.clientHeight - 10;
    setUserScrolled(isScroll);
    if (
      scrollContainer.scrollTop ===
      scrollContainer.scrollHeight - scrollContainer.clientHeight
    ) {
      setNotification(0);
    }
  }, []);

  const scrollDown = useCallback(() => {
    setNotification(0);
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!selectedRoom?.id) return;

    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/messages/${selectedRoom.id}`);
        if (!res.ok) throw new Error(await res.text());

        const { messages } = await res.json();
        if (messages) {
          const formattedMessages = messages.map((msg: any) => ({
            ...msg,
            profiles: msg.profiles
                ? {
                    id: msg.profiles.id,
                    avatar_url: msg.profiles.avatar_url || null,
                    display_name: msg.profiles.display_name || null,
                    username: msg.profiles.username || null,
                    created_at: msg.profiles.created_at || null,
                    bio: msg.profiles.bio || null,
                    updated_at: msg.profiles.updated_at || null,
                  }
                : null,


          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        toast.error("Failed to load messages");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialMessages();
  }, [selectedRoom?.id, setMessages]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!selectedRoom) return;

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
            const messagePayload = payload.new as MessageRow;
            if (messagePayload.room_id !== selectedRoom.id) return;

            if (payload.eventType === "INSERT" && !optimisticIds.includes(messagePayload.id)) {
              supabase
               .from("profiles")
                .select("*")
                .eq("id", messagePayload.sender_id)
                .single<ProfileRow>()
                .then(({ data: user, error }) => {
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  if (user) {
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
                          id: user.id,
                          avatar_url: user.avatar_url || null,
                          display_name: user.display_name || null,
                          username: user.username || null,
                          created_at: user.created_at || null,
                          bio: user.bio || null,
                          updated_at: user.updated_at || null,
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
                  }
                });
            } else if (payload.eventType === "UPDATE") {
              optimisticUpdateMessage(messagePayload.id, {
                id: messagePayload.id,
                text: messagePayload.text,
                is_edited: messagePayload.is_edited,
                created_at: messagePayload.created_at,
                sender_id: messagePayload.sender_id,
                room_id: messagePayload.room_id,
                direct_chat_id: messagePayload.direct_chat_id,
                dm_thread_id: messagePayload.dm_thread_id,
                status: messagePayload.status,
              });
            } else if (payload.eventType === "DELETE") {
              optimisticDeleteMessage(payload.old.id);
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
  }, [selectedRoom, optimisticIds, addMessage, optimisticUpdateMessage, optimisticDeleteMessage, supabase]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, userScrolled]);

  // Memoized filtered messages
  const filteredMessages = useMemo(() => {
    return messages
      .filter((msg) => msg.room_id === selectedRoom?.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selectedRoom?.id]);

  const SkeletonMessage = () => (
    <div className="flex gap-2 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-700" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-700 rounded w-1/4" />
        <div className="h-3 bg-gray-700 rounded w-3/4" />
      </div>
    </div>
  );

  return (
    <>
      <div
        className="flex-1 flex flex-col p-1 h-auto overflow-y-auto"
        ref={scrollRef}
        onScroll={handleOnScroll}
      >
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <SkeletonMessage key={index} />
          ))
        ) : (
          <>
            

            {/* Typing Indicator */}
            {selectedRoom?.id && user?.id && (
              <TypingIndicator roomId={selectedRoom.id} currentUserId={user.id} />
            )}

            <div className="space-y-[.5em]">
              {filteredMessages.map((value) => (
                <Message key={value.id} message={value} />
              ))}
            </div>
          </>
        )}

        <DeleteAlert />
        <EditAlert />
      </div>

      {userScrolled && (
        <div className="absolute bottom-20 w-full">
          {notification ? (
            <div
              className="w-36 mx-auto bg-indigo-500 p-1 rounded-md cursor-pointer"
              onClick={scrollDown}
            >
              <h1>New {notification} messages</h1>
            </div>
          ) : (
            <div
              className="w-10 h-10 bg-blue-500 rounded-full justify-center items-center flex mx-auto border cursor-pointer hover:scale-110 transition-all"
              onClick={scrollDown}
            >
              <ArrowDown />
            </div>
          )}
        </div>
      )}
    </>
  );
}
