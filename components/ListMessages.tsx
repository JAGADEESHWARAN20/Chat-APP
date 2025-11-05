"use client";

import { Imessage, transformApiMessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { useSelectedRoom } from "@/lib/store/RoomContext";
import TypingIndicator from "./TypingIndicator";
import { useUser } from "@/lib/store/user";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
// type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default function ListMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [notification, setNotification] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ FIXED: Use Zustand selector
  const selectedRoom = useSelectedRoom();
  const user = useUser((state) => state.user);
  console.log(user);
  const {
    messages,
    setMessages,
    addMessage,
    optimisticIds,
    optimisticDeleteMessage,
    optimisticUpdateMessage,
  } = useMessage((state) => state);

  const supabase = getSupabaseBrowserClient();
  const messagesLoadedRef = useRef<Set<string>>(new Set());
  const prevRoomIdRef = useRef<string | null>(null); // ✅ FIXED: Track previous room

  const handleOnScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const scrollContainer = scrollRef.current;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;

    setUserScrolled(!isNearBottom);
    if (isNearBottom) setNotification(0);
  }, []);

  const scrollDown = useCallback(() => {
    setNotification(0);
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);


  
  // ✅ FIXED: Memoized realtime handler
  const handleRealtimePayload = useCallback(
    (payload: any) => {
      try {
        if (!selectedRoom || payload.new?.room_id !== selectedRoom.id) {
          return;
        }

        const messagePayload = payload.new as MessageRow;

        if (payload.eventType === "INSERT") {
          if (optimisticIds.includes(messagePayload.id)) {
            return;
          }

          if (messages.some(m => m.id === messagePayload.id)) {
            return;
          }

          supabase
            .from("profiles")
            .select("*")
            .eq("id", messagePayload.sender_id)
            .single()
            .then(({ data: profile, error }) => {
              if (error) {
                console.error("Error fetching profile:", error);
                return;
              }

              const newMessage: Imessage = {
                ...messagePayload,
                profiles: profile ? {
                  id: profile.id,
                  avatar_url: profile.avatar_url ?? null,
                  display_name: profile.display_name ?? null,
                  username: profile.username ?? null,
                  created_at: profile.created_at ?? null,
                  bio: profile.bio ?? null,
                  updated_at: profile.updated_at ?? null,
                } : {
                  id: messagePayload.sender_id,
                  avatar_url: null,
                  display_name: null,
                  username: null,
                  created_at: null,
                  bio: null,
                  updated_at: null,
                },
              };

              addMessage(newMessage);

              if (scrollRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
                const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
                
                if (!isAtBottom) {
                  setNotification(prev => prev + 1);
                }
              }
            });

        } else if (payload.eventType === "UPDATE") {
          optimisticUpdateMessage(messagePayload.id, {
            text: messagePayload.text,
            is_edited: messagePayload.is_edited,
          });

        } else if (payload.eventType === "DELETE") {
          optimisticDeleteMessage(payload.old.id);
        }
      } catch (err) {
        console.error("[ListMessages] Realtime payload error:", err);
      }
    },
    [selectedRoom, messages, optimisticIds, addMessage, optimisticUpdateMessage, optimisticDeleteMessage, supabase]
  );


    // ✅ FIXED: Load initial messages with proper room change detection
    useEffect(() => {
      if (!selectedRoom?.id) return;
    
      console.log(`[ListMessages] Setting up realtime for room: ${selectedRoom.id}`);
    
      const messageChannel = supabase.channel(`room_messages_${selectedRoom.id}`, {
        config: { broadcast: { self: false } }
      });
    
      messageChannel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${selectedRoom.id}`
          },
          handleRealtimePayload
        )
        .subscribe((status) => {
          console.log(`[ListMessages] Realtime status for room ${selectedRoom.id}:`, status);
        });
    
      return () => {
        console.log(`[ListMessages] Cleaning up realtime for room: ${selectedRoom.id}`);
        supabase.removeChannel(messageChannel);
      };
    }, [selectedRoom?.id, supabase, handleRealtimePayload]);
    
    
  // ✅ FIXED: Real-time subscription with proper cleanup and dependencies
  useEffect(() => {
    if (!selectedRoom?.id) return;

    console.log(`[ListMessages] Setting up realtime for room: ${selectedRoom.id}`);

    const messageChannel = supabase.channel(`room_messages_${selectedRoom.id}`, {
      config: {
        broadcast: { self: false }
      }
    });

    messageChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        handleRealtimePayload
      )
      .subscribe((status) => {
        console.log(`[ListMessages] Realtime status for room ${selectedRoom.id}:`, status);
      });

    return () => {
      console.log(`[ListMessages] Cleaning up realtime for room: ${selectedRoom.id}`);
      supabase.removeChannel(messageChannel);
    };
  }, [selectedRoom?.id, supabase, handleRealtimePayload]);

  // ✅ FIXED: Auto-scroll with better room change detection
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (!scrollRef.current || !selectedRoom?.id) return;

    const isNewMessage = prevMessagesLength.current < messages.length;
    const isRoomChanged = selectedRoom.id !== prevRoomIdRef.current;

    if (isRoomChanged) {
      // Room changed, scroll to top
      scrollRef.current.scrollTop = 0;
      prevRoomIdRef.current = selectedRoom.id;
    } else if (isNewMessage && !userScrolled) {
      // New messages and user hasn't scrolled up, scroll to bottom
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    prevMessagesLength.current = messages.length;
  }, [messages.length, userScrolled, selectedRoom?.id]);

  // ✅ FIXED: Memoized message filtering
  const filteredMessages = useMemo(() => {
    if (!messages.length || !selectedRoom?.id) return [];
    
    return messages
      .filter(msg => msg.room_id === selectedRoom.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selectedRoom?.id]);

  const SkeletonMessage = React.memo(() => (
    <div className="flex gap-2 animate-pulse w-full p-2">
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
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleOnScroll}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
        style={{ 
          height: "calc(100vh - 8rem)"
        }}
      >
        <div className="w-full max-w-full">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, index) => (
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
        </div>
      </div>

      {/* Typing Indicator */}
      <TypingIndicator />

      {/* New messages notification */}
      {notification > 0 && (
        <div className="absolute bottom-20 right-4 z-10">
          <button
            onClick={scrollDown}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors text-sm"
          >
            {notification} new message{notification > 1 ? 's' : ''} ↓
          </button>
        </div>
      )}

      <DeleteAlert />
      <EditAlert />
    </div>
  );
}