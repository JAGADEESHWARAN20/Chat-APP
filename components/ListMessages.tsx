"use client";

import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import LoadMoreMessages from "./LoadMoreMessages";
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
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const user = useUser((state) => state.user);

  const {
    messages,
    addMessage,
    optimisticIds,
    optimisticDeleteMessage,
    optimisticUpdateMessage,
    subscribeToRoom,
    unsubscribeFromRoom,
    clearMessages,
    hasMore,
    setMessages,
    page
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

  // --- REFACTOR: Initial Load and Real-time Subscriptions are now handled in Zustand store ---
  useEffect(() => {
    if (!selectedRoom?.id) {
      // Clear messages when a room is not selected or changes
      clearMessages();
      return;
    }
    
    // Unsubscribe from any previous room and then subscribe to the new one
    unsubscribeFromRoom();
    subscribeToRoom(selectedRoom.id);
    
    // Load the initial messages using the dedicated function in the store
    const loadInitialMessages = async () => {
      const res = await fetch(`/api/messages/${selectedRoom.id}`);
      if (!res.ok) {
        toast.error("Failed to load initial messages.");
        return;
      }
      const { messages } = await res.json();
      if (messages) {
        setMessages(messages);
      }
    };
    
    loadInitialMessages();
    
    // Clean up on component unmount or room change
    return () => {
      unsubscribeFromRoom();
    };
  }, [selectedRoom?.id, subscribeToRoom, unsubscribeFromRoom, clearMessages, setMessages]);


  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, userScrolled]);

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
        {filteredMessages.length === 0 && page === 1 && (
           <div className="flex justify-center items-center h-full">
             <p className="text-gray-500">Loading...</p>
           </div>
        )}
        
        {filteredMessages.length > 0 && (
          <div className="flex-1 pb-5">
            {hasMore && <LoadMoreMessages />}
          </div>
        )}

        {selectedRoom?.id && user?.id && (
          <TypingIndicator roomId={selectedRoom.id} currentUserId={user.id} />
        )}

        <div className="space-y-[.5em]">
          {filteredMessages.map((value) => (
            <Message key={value.id} message={value} />
          ))}
        </div>
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