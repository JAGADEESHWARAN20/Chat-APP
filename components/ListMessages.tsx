"use client";

import { Imessage, transformApiMessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Database } from "@/lib/types/supabase";
import { useUser } from "@/lib/store/user";
import { useSelectedRoom } from "@/lib/store/roomstore"; // ✅ Use the selector
import TypingIndicator from "./TypingIndicator";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export default function ListMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [notification, setNotification] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ FIXED: Use the selector to get the selected room
  const selectedRoom = useSelectedRoom();
  const user = useUser((state) => state.user);
  
  console.log('ListMessages - Selected room:', selectedRoom);

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
  const prevRoomIdRef = useRef<string | null>(null);

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

  // ✅ FIXED: Load initial messages with proper room change detection
  useEffect(() => {
    const currentRoomId = selectedRoom?.id;
    
    if (!currentRoomId) {
      setMessages([]);
      messagesLoadedRef.current.clear();
      prevRoomIdRef.current = null;
      return;
    }
  
    const roomChanged = currentRoomId !== prevRoomIdRef.current;
  
    // ✅ Clear old room messages when switching
    if (roomChanged) {
      setMessages([]);
      messagesLoadedRef.current.delete(prevRoomIdRef.current || "");
    }
  
    const alreadyLoaded = messagesLoadedRef.current.has(currentRoomId);
    if (alreadyLoaded || isLoading) return;
  
    prevRoomIdRef.current = currentRoomId;
  
    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        console.log(`Loading messages for room: ${currentRoomId}`);
        const res = await fetch(`/api/messages/${currentRoomId}?t=${Date.now()}`);
        const data = await res.json();
        const fetchedMessages = Array.isArray(data.messages) ? data.messages : [];
        setMessages(fetchedMessages.map(transformApiMessage));
        messagesLoadedRef.current.add(currentRoomId);
        console.log(`Loaded ${fetchedMessages.length} messages for room: ${currentRoomId}`);
      } catch (error) {
        console.error("Load messages error:", error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadInitialMessages();
  }, [selectedRoom?.id, setMessages, isLoading]);

  // ✅ FIXED: Memoized realtime handler
  const handleRealtimePayload = useCallback(
    (payload: any) => {
      try {
        const currentRoomId = selectedRoom?.id;
        if (!currentRoomId || payload.new?.room_id !== currentRoomId) {
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
    [selectedRoom?.id, messages, optimisticIds, addMessage, optimisticUpdateMessage, optimisticDeleteMessage, supabase]
  );

  // ✅ FIXED: Real-time subscription with proper cleanup and dependencies
  useEffect(() => {
    const currentRoomId = selectedRoom?.id;
    if (!currentRoomId) return;

    console.log(`[ListMessages] Setting up realtime for room: ${currentRoomId}`);

    const messageChannel = supabase.channel(`room_messages_${currentRoomId}`, {
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
          filter: `room_id=eq.${currentRoomId}`
        },
        handleRealtimePayload
      )
      .subscribe((status) => {
        console.log(`[ListMessages] Realtime status for room ${currentRoomId}:`, status);
      });

    return () => {
      console.log(`[ListMessages] Cleaning up realtime for room: ${currentRoomId}`);
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
    const currentRoomId = selectedRoom?.id;
    if (!messages.length || !currentRoomId) return [];
    
    return messages
      .filter(msg => msg.room_id === currentRoomId)
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
      <div 
        className="flex items-center justify-center h-full overflow-hidden"
        style={{ 
          color: 'hsl(var(--no-messages-color))',
          fontSize: 'var(--no-messages-size)' 
        }}
      >
        <p>Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div className="h-[75vh] w-full flex flex-col  overflow-hidden">
      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleOnScroll}
        className="flex-1 overflow-y-scroll  px-4  py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
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
            <div 
              className="flex items-center justify-center h-full"
              style={{ 
                color: 'hsl(var(--no-messages-color))',
                fontSize: 'var(--no-messages-size)' 
              }}
            >
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