"use client";

import { Imessage, transformApiMessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Database } from "@/lib/types/supabase";
import { useUser } from "@/lib/store/user";
import { useSelectedRoom } from "@/lib/store/roomstore";
import TypingIndicator from "./TypingIndicator";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchHighlight } from "@/lib/store/SearchHighlightContext";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

interface ListMessagesProps {
  searchQuery?: string;
  isSearching?: boolean;
  onSearchStateChange?: (searching: boolean) => void;
  onSearchTrigger?: () => void; // New prop to trigger search in parent
}

// Search Algorithm - Inverted Index with string IDs
class MessageSearchEngine {
  private invertedIndex: Map<string, Set<string>> = new Map();
  private messages: Map<string, Imessage> = new Map();

  indexMessage(message: Imessage) {
    this.messages.set(message.id, message);
    const words = this.tokenize(message.text);
    
    for (const word of words) {
      if (!this.invertedIndex.has(word)) {
        this.invertedIndex.set(word, new Set());
      }
      this.invertedIndex.get(word)!.add(message.id);
    }
  }

  removeMessage(messageId: string) {
    this.messages.delete(messageId);
    for (const [word, messageIds] of this.invertedIndex.entries()) {
      messageIds.delete(messageId);
      if (messageIds.size === 0) {
        this.invertedIndex.delete(word);
      }
    }
  }

  search(query: string): Imessage[] {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return [];

    let results: Set<string> | null = null;
    
    for (const word of queryWords) {
      const wordResults = this.invertedIndex.get(word);
      if (!wordResults) return [];
      
      if (results === null) {
        results = new Set(wordResults);
      } else {
        results = new Set([...results].filter((id: string) => wordResults.has(id)));
      }
    }

    if (!results) return [];
    
    return Array.from(results)
      .map(id => this.messages.get(id))
      .filter((msg): msg is Imessage => msg !== undefined)
      .sort((a, b) => {
        const aScore = this.calculateSequenceRelevance(a, query);
        const bScore = this.calculateSequenceRelevance(b, query);
        return bScore - aScore;
      });
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private calculateSequenceRelevance(message: Imessage, query: string): number {
    const text = message.text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let score = 0;
    
    if (text.includes(lowerQuery)) {
      score += 1000;
      
      const words = text.split(/\s+/);
      for (const word of words) {
        if (word.startsWith(lowerQuery)) {
          score += 500;
          break;
        }
      }
    }
    
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
    let allWordsFound = true;
    
    queryWords.forEach(word => {
      if (text.includes(word)) {
        const occurrences = (text.split(word).length - 1);
        score += occurrences * 100;
        
        if (text.startsWith(word)) {
          score += 200;
        }
      } else {
        allWordsFound = false;
      }
    });
    
    if (allWordsFound) {
      score += 300;
    }
    
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const daysOld = messageAge / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 50 - daysOld);
    score += recencyBonus;
    
    return score;
  }

  clear() {
    this.invertedIndex.clear();
    this.messages.clear();
  }
}

export default function ListMessages({ 
  searchQuery = "", 
  isSearching = false, 
  onSearchStateChange,
  onSearchTrigger // New prop
}: ListMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [notification, setNotification] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentNavigatedMessageId, setCurrentNavigatedMessageId] = useState<string | null>(null);

  const selectedRoom = useSelectedRoom();
  const user = useUser((state) => state.user);
  
  const {
    messages,
    setMessages,
    addMessage,
    optimisticIds,
    optimisticDeleteMessage,
    optimisticUpdateMessage,
  } = useMessage((state) => state);

  const { setHighlightedMessageId } = useSearchHighlight();
  const supabase = getSupabaseBrowserClient();
  const messagesLoadedRef = useRef<Set<string>>(new Set());
  const prevRoomIdRef = useRef<string | null>(null);
  
  const searchEngineRef = useRef<MessageSearchEngine>(new MessageSearchEngine());

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

  // Search trigger handler
  const handleSearchTrigger = useCallback(() => {
    onSearchTrigger?.();
  }, [onSearchTrigger]);

  // Index messages for search when they load
  useEffect(() => {
    if (messages.length > 0 && selectedRoom?.id) {
      searchEngineRef.current.clear();
      messages.forEach(msg => {
        if (msg.room_id === selectedRoom.id) {
          searchEngineRef.current.indexMessage(msg);
        }
      });
    }
  }, [messages, selectedRoom?.id]);

  // Handle search from header input
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setHighlightedMessageId(null);
      setCurrentNavigatedMessageId(null);
      onSearchStateChange?.(false);
      return;
    }

    onSearchStateChange?.(true);
    
    setTimeout(() => {
      try {
        const results = searchEngineRef.current.search(searchQuery);
        
        // Auto-navigate to first result in real-time as user types
        if (results.length > 0) {
          const bestMatch = results[0];
          setHighlightedMessageId(bestMatch.id);
          setCurrentNavigatedMessageId(bestMatch.id);
          
          // Scroll to the matched message
          setTimeout(() => {
            const messageElement = document.getElementById(`msg-${bestMatch.id}`);
            if (messageElement) {
              messageElement.scrollIntoView({ 
                behavior: "smooth", 
                block: "center" 
              });
            }
          }, 100);
        } else {
          setHighlightedMessageId(null);
          setCurrentNavigatedMessageId(null);
        }
      } catch (error) {
        console.error("Search error:", error);
        setHighlightedMessageId(null);
        setCurrentNavigatedMessageId(null);
      } finally {
        onSearchStateChange?.(false);
      }
    }, 0);
  }, [searchQuery, setHighlightedMessageId, onSearchStateChange]);

  // Clear navigation when search query is cleared
  useEffect(() => {
    if (!searchQuery) {
      setCurrentNavigatedMessageId(null);
      setHighlightedMessageId(null);
    }
  }, [searchQuery, setHighlightedMessageId]);

  // Load initial messages
  useEffect(() => {
    const currentRoomId = selectedRoom?.id;
    
    if (!currentRoomId) {
      setMessages([]);
      messagesLoadedRef.current.clear();
      prevRoomIdRef.current = null;
      searchEngineRef.current.clear();
      return;
    }
  
    const roomChanged = currentRoomId !== prevRoomIdRef.current;
  
    if (roomChanged) {
      setMessages([]);
      messagesLoadedRef.current.delete(prevRoomIdRef.current || "");
      searchEngineRef.current.clear();
    }
  
    const alreadyLoaded = messagesLoadedRef.current.has(currentRoomId);
    if (alreadyLoaded || isLoading) return;
  
    prevRoomIdRef.current = currentRoomId;
  
    const loadInitialMessages = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/messages/${currentRoomId}?t=${Date.now()}`);
        const data = await res.json();
        const fetchedMessages = Array.isArray(data.messages) ? data.messages : [];
        const transformedMessages = fetchedMessages.map(transformApiMessage);
        setMessages(transformedMessages);
        messagesLoadedRef.current.add(currentRoomId);
      } catch (error) {
        console.error("Load messages error:", error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadInitialMessages();
  }, [selectedRoom?.id, setMessages, isLoading]);

  // Real-time subscription
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
              searchEngineRef.current.indexMessage(newMessage);

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
          const updatedMessage = messages.find(m => m.id === messagePayload.id);
          if (updatedMessage) {
            searchEngineRef.current.removeMessage(messagePayload.id);
            searchEngineRef.current.indexMessage({
              ...updatedMessage,
              text: messagePayload.text,
              is_edited: messagePayload.is_edited,
            });
          }

        } else if (payload.eventType === "DELETE") {
          optimisticDeleteMessage(payload.old.id);
          searchEngineRef.current.removeMessage(payload.old.id);
        }
      } catch (err) {
        console.error("[ListMessages] Realtime payload error:", err);
      }
    },
    [selectedRoom?.id, messages, optimisticIds, addMessage, optimisticUpdateMessage, optimisticDeleteMessage, supabase]
  );

  useEffect(() => {
    const currentRoomId = selectedRoom?.id;
    if (!currentRoomId) return;

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
      supabase.removeChannel(messageChannel);
    };
  }, [selectedRoom?.id, supabase, handleRealtimePayload]);

  // Auto-scroll logic
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (!scrollRef.current || !selectedRoom?.id) return;

    const isNewMessage = prevMessagesLength.current < messages.length;
    const isRoomChanged = selectedRoom.id !== prevRoomIdRef.current;

    if (isRoomChanged) {
      scrollRef.current.scrollTop = 0;
      prevRoomIdRef.current = selectedRoom.id;
    } else if (isNewMessage && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    prevMessagesLength.current = messages.length;
  }, [messages.length, userScrolled, selectedRoom?.id]);

  // Filter messages for current room
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
    <div className="h-[75dvh] w-full flex flex-col overflow-hidden relative">
      {/* Search Trigger Button - Top Right Corner */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSearchTrigger}
        className={cn(
          "absolute top-4 right-4 z-30 w-[2.5em] h-[2.5em] flex items-center justify-center rounded-full",
          "bg-[hsl(var(--background))]/60 backdrop-blur-md shadow-sm",
          "transition-all duration-300 ease-in-out group hover:bg-[hsl(var(--action-active))]/15 active:scale-95",
          "focus-visible:ring-[hsl(var(--action-ring))]/50 focus-visible:ring-2",
          "text-[hsl(var(--foreground))]"
        )}
        title="Search Messages"
      >
        <Search className="h-5 w-5 transition-all duration-300 stroke-[hsl(var(--muted-foreground))]" />
      </Button>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleOnScroll}
        className="flex-1 overflow-y-scroll px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
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
              <Message 
                key={message.id} 
                message={message} 
                isNavigated={currentNavigatedMessageId === message.id}
                searchQuery={searchQuery}
              />
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
            title="Scroll to latest messages"
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