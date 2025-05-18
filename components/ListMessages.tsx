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
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { LIMIT_MESSAGE } from "@/lib/constant";

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
  const { messages, setMessages } = useMessage((state) => state);
  const supabase = supabaseBrowser();

  // Use the useRealtimeMessages hook
  useRealtimeMessages(selectedRoom?.id, null, () => {
    setNotification((prev) => prev + 1);
  });

  const handleOnScroll = () => {
    if (!scrollRef.current) return;
    const scrollContainer = scrollRef.current;
    const isScroll = scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight - 10;
    setUserScrolled(isScroll);
    if (scrollContainer.scrollTop === scrollContainer.scrollHeight - scrollContainer.clientHeight) {
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
      supabase.removeChannel(notificationChannel);
    };
  }, [selectedRoom, supabase]);

  useEffect(() => {
    if (scrollRef.current && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, userScrolled]);

  const filteredMessages = messages.filter((msg) => msg.room_id === selectedRoom?.id);

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
        className="flex-1 flex flex-col p-5 h-full overflow-y-auto"
        ref={scrollRef}
        onScroll={handleOnScroll}
      >
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => <SkeletonMessage key={index} />)
        ) : (
          <>
            <div className="flex-1 pb-5">
              <LoadMoreMessages />
            </div>
            <div className="space-y-7">
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
