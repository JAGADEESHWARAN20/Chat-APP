"use client";

import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import LoadMoreMessages from "./LoadMoreMessages";
import { Database } from "@/lib/types/supabase";
import { useRoomStore } from "@/lib/store/roomstore";
import TypingIndicator from "./TypingIndicator"; // import TypingIndicator
import { useUser } from "@/lib/store/user";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type Notification = Database["public"]["Tables"]["notifications"]["Row"] & {
  rooms?: { name: string };
  users?: { username: string };
};

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

  const handleOnScroll = () => {
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
  };

  const scrollDown = () => {
    setNotification(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (!selectedRoom?.id) return;

    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/messages/${selectedRoom.id}`);
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const { messages } = await res.json();

        if (messages) {
          const formattedMessages = messages.map((msg: any) => ({
            ...msg,
            users: msg.users
              ? {
                  id: msg.users.id,
                  avatar_url: msg.users.avatar_url || "",
                  display_name: msg.users.display_name || "",
                  username: msg.users.username || "",
                  created_at: msg.users.created_at,
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
            if (
              payload.eventType === "INSERT" &&
              !optimisticIds.includes(messagePayload.id)
            ) {
              if (messagePayload.room_id !== selectedRoom.id) return;

              supabase
                .from("users")
                .select("*")
                .eq("id", messagePayload.sender_id)
                .single<UserRow>()
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
                      users: {
                        id: user.id,
                        avatar_url: user.avatar_url || "",
                        display_name: user.display_name || "",
                        username: user.username || "",
                        created_at: user.created_at,
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
              const updatedMessage = payload.new as MessageRow;
              if (updatedMessage.room_id !== selectedRoom.id) return;

              optimisticUpdateMessage(updatedMessage.id, {
                id: updatedMessage.id,
                text: updatedMessage.text,
                is_edited: updatedMessage.is_edited,
                created_at: updatedMessage.created_at,
                sender_id: updatedMessage.sender_id,
                room_id: updatedMessage.room_id,
                direct_chat_id: updatedMessage.direct_chat_id,
                dm_thread_id: updatedMessage.dm_thread_id,
                status: updatedMessage.status,
              });
            } else if (payload.eventType === "DELETE") {
              const deletedMessage = payload.old as MessageRow;
              if (deletedMessage.room_id !== selectedRoom.id) return;

              optimisticDeleteMessage(payload.old.id);
            }
          } catch (err) {
            toast.error("Error processing real-time message update");
            console.error(err);
          }
        }
      )
      .subscribe();

    const notificationChannel = supabase
      .channel("global-notifications")
      .on(
        "broadcast",
        { event: "new-message" },
        (payload) => {
          const newNotification = payload.payload as Notification;
          if (newNotification.room_id !== selectedRoom.id) {
            toast.info(newNotification.message);
          }
        }
      )
      .on(
        "broadcast",
        { event: "user_joined" },
        (payload) => {
          const newNotification = payload.payload as Notification;
          if (newNotification.room_id !== selectedRoom.id) {
            toast.info(newNotification.message);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [
    selectedRoom,
    optimisticIds,
    addMessage,
    optimisticUpdateMessage,
    optimisticDeleteMessage,
    supabase,
  ]);

  useEffect(() => {
    if (scrollRef.current && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, userScrolled]);

  const filteredMessages = messages.filter(
    (msg) => msg.room_id === selectedRoom?.id
  );

  const SkeletonMessage = () => (
    <div className="flex gap-2 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-700" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-700 rounded w-1/4" />
        <div className="h-3 bg-gray-700 rounded w-3/4" />
      </div>
    </div>
  );

  // Optional: prepare userMap from messages (to pass to TypingIndicator showing names)
  const userMap = filteredMessages.reduce((acc, msg) => {
    if (msg.users && !acc[msg.users.id]) {
      acc[msg.users.id] = { display_name: msg.users.display_name };
    }
    return acc;
  }, {} as Record<string, { display_name: string }>);

  return (
    <>
      <div
        className="flex-1 flex flex-col p-1 h-auto  overflow-y-auto"
        ref={scrollRef}
        onScroll={handleOnScroll}
      >
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <SkeletonMessage key={index} />
          ))
        ) : (
          <>
            <div className="flex-1 pb-5">
              <LoadMoreMessages />
            </div>

            {/* Typing Indicator shown here */}
            {selectedRoom?.id && (
              <TypingIndicator roomId={selectedRoom.id} userMap={userMap} />
            )}

            <div className="space-y-2">
              {[...filteredMessages]
                .sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                )
                .map((value) => (
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
