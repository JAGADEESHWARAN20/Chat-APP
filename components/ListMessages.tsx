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
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchHighlight } from "@/lib/store/SearchHighlightContext";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

interface ListMessagesProps {
  searchQuery?: string;
  isSearching?: boolean;
  onSearchStateChange?: (searching: boolean) => void;
  onSearchTrigger?: () => void;
   isSearchExpanded?: boolean;
}

// Enhanced Search Engine with Character Sequence Matching
class MessageSearchEngine {
  private invertedIndex: Map<string, Set<string>> = new Map();
  private messages: Map<string, Imessage> = new Map();
  private characterIndex: Map<string, Set<string>> = new Map();

  indexMessage(message: Imessage) {
    this.messages.set(message.id, message);
    const words = this.tokenize(message.text);
    
    // Index words for full word search
    for (const word of words) {
      if (!this.invertedIndex.has(word)) {
        this.invertedIndex.set(word, new Set());
      }
      this.invertedIndex.get(word)!.add(message.id);
    }

    // Index character sequences for partial matching
    this.indexCharacterSequences(message.id, message.text);
  }

  private indexCharacterSequences(messageId: string, text: string) {
    const cleanText = text.toLowerCase();
    
    // Index all possible character sequences (from 1 to full length)
    for (let start = 0; start < cleanText.length; start++) {
      for (let length = 1; length <= Math.min(10, cleanText.length - start); length++) {
        const sequence = cleanText.substring(start, start + length);
        
        if (!this.characterIndex.has(sequence)) {
          this.characterIndex.set(sequence, new Set());
        }
        this.characterIndex.get(sequence)!.add(messageId);
      }
    }
  }

  removeMessage(messageId: string) {
    this.messages.delete(messageId);
    
    // Remove from word index
    for (const [word, messageIds] of this.invertedIndex.entries()) {
      messageIds.delete(messageId);
      if (messageIds.size === 0) {
        this.invertedIndex.delete(word);
      }
    }
    
    // Remove from character index
    for (const [sequence, messageIds] of this.characterIndex.entries()) {
      messageIds.delete(messageId);
      if (messageIds.size === 0) {
        this.characterIndex.delete(sequence);
      }
    }
  }

  search(query: string): Imessage[] {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return [];

    const lowerQuery = query.toLowerCase();
    
    // Use character sequence matching for better partial matching
    let results: Set<string> = new Set();
    
    // Strategy 1: Character sequence matching (most important for partial matches)
    for (const [sequence, messageIds] of this.characterIndex.entries()) {
      if (lowerQuery.includes(sequence) || sequence.includes(lowerQuery)) {
        messageIds.forEach(id => results.add(id));
      }
    }

    // Strategy 2: Word-based matching (for complete words)
    for (const word of queryWords) {
      const wordResults = this.invertedIndex.get(word);
      if (wordResults) {
        wordResults.forEach(id => results.add(id));
      }
    }

    // Strategy 3: Direct text contains (fallback)
    for (const [id, message] of this.messages.entries()) {
      if (message.text.toLowerCase().includes(lowerQuery)) {
        results.add(id);
      }
    }

    if (results.size === 0) return [];

    // Score and sort results by relevance
    return Array.from(results)
      .map(id => this.messages.get(id))
      .filter((msg): msg is Imessage => msg !== undefined)
      .sort((a, b) => {
        const aScore = this.calculateEnhancedRelevance(a, query);
        const bScore = this.calculateEnhancedRelevance(b, query);
        return bScore - aScore;
      });
  }

  private calculateEnhancedRelevance(message: Imessage, query: string): number {
    const text = message.text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Exact match bonus (highest priority)
    if (text === lowerQuery) {
      score += 5000;
    }

    // Query starts with text or text starts with query
    if (text.startsWith(lowerQuery) || lowerQuery.startsWith(text)) {
      score += 2000;
    }

    // Exact phrase match
    if (text.includes(lowerQuery)) {
      score += 1500;
      
      // Position bonus - matches at start are better
      const position = text.indexOf(lowerQuery);
      if (position === 0) {
        score += 1000;
      } else if (position < 10) {
        score += 500;
      }
    }

    // Word boundary matches
    const words = text.split(/\s+/);
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
    
    let allWordsFound = true;
    let wordBoundaryMatches = 0;

    queryWords.forEach(queryWord => {
      let wordFound = false;
      
      words.forEach(word => {
        // Exact word match
        if (word === queryWord) {
          score += 800;
          wordFound = true;
          wordBoundaryMatches++;
        }
        // Word starts with query
        else if (word.startsWith(queryWord)) {
          score += 400;
          wordFound = true;
          wordBoundaryMatches++;
        }
        // Word contains query
        else if (word.includes(queryWord)) {
          score += 200;
          wordFound = true;
        }
        // Query contains word (partial match)
        else if (queryWord.includes(word) && word.length > 2) {
          score += 100;
          wordFound = true;
        }
      });

      if (!wordFound) {
        allWordsFound = false;
      }
    });

    // All words found bonus
    if (allWordsFound) {
      score += 600;
    }

    // Word boundary match bonus
    if (wordBoundaryMatches === queryWords.length) {
      score += 400;
    }

    // Character sequence matching score
    let sequenceScore = 0;
    for (let i = 0; i < lowerQuery.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 10, lowerQuery.length); j++) {
        const sequence = lowerQuery.substring(i, j);
        if (text.includes(sequence)) {
          sequenceScore += sequence.length * 10; // Longer sequences get more weight
        }
      }
    }
    score += sequenceScore;

    // Recency bonus (newer messages rank higher)
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const daysOld = messageAge / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 100 - daysOld);
    score += recencyBonus;

    // Length similarity bonus (similar length messages rank higher)
    const lengthDifference = Math.abs(text.length - lowerQuery.length);
    if (lengthDifference < 10) {
      score += 200;
    }

    return score;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  clear() {
    this.invertedIndex.clear();
    this.messages.clear();
    this.characterIndex.clear();
  }

  getMessageCount(): number {
    return this.messages.size;
  }
}

export default function ListMessages({ 
  searchQuery = "", 
  onSearchStateChange,
  onSearchTrigger,
  isSearchExpanded  
}: ListMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [notification, setNotification] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentNavigatedMessageId, setCurrentNavigatedMessageId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Imessage[]>([]);
  const [showSearchInfo, setShowSearchInfo] = useState(false);

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

  // Enhanced scroll to message
  const scrollToMessage = useCallback((messageId: string, behavior: ScrollBehavior = 'smooth') => {
    const messageElement = document.getElementById(`msg-${messageId}`);
    if (messageElement && scrollRef.current) {
      messageElement.scrollIntoView({ 
        behavior, 
        block: "center" 
      });
    }
  }, []);

  // Search trigger handler
  const handleSearchTrigger = useCallback(() => {
    onSearchTrigger?.();
  }, [onSearchTrigger]);

  // Clear search results
  const handleClearSearch = useCallback(() => {
    setSearchResults([]);
    setHighlightedMessageId(null);
    setCurrentNavigatedMessageId(null);
    setShowSearchInfo(false);
    onSearchStateChange?.(false);
  }, [setHighlightedMessageId, onSearchStateChange]);

  // Index messages for search when they load
  useEffect(() => {
    if (messages.length > 0 && selectedRoom?.id) {
      const roomMessages = messages.filter(msg => msg.room_id === selectedRoom.id);
      if (roomMessages.length > 0) {
        searchEngineRef.current.clear();
        roomMessages.forEach(msg => {
          searchEngineRef.current.indexMessage(msg);
        });
      }
    }
  }, [messages, selectedRoom?.id]);

  // ENHANCED: Real-time search with character sequence matching
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      handleClearSearch();
      return;
    }

    onSearchStateChange?.(true);
    setShowSearchInfo(true);
    
    // Immediate search for better responsiveness
    const searchTimeout = setTimeout(() => {
      try {
        const results = searchEngineRef.current.search(searchQuery);
        setSearchResults(results);
        
        if (results.length > 0) {
          const bestMatch = results[0];
          setHighlightedMessageId(bestMatch.id);
          setCurrentNavigatedMessageId(bestMatch.id);
          
          // Auto-scroll to the first result with slight delay
          setTimeout(() => {
            scrollToMessage(bestMatch.id, 'smooth');
          }, 50);
        } else {
          setHighlightedMessageId(null);
          setCurrentNavigatedMessageId(null);
        }
      } catch (error) {
        console.error("Search error:", error);
        setHighlightedMessageId(null);
        setCurrentNavigatedMessageId(null);
        setSearchResults([]);
      } finally {
        onSearchStateChange?.(false);
      }
    }, 50); // Reduced debounce for instant feedback

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, setHighlightedMessageId, onSearchStateChange, handleClearSearch, scrollToMessage]);

  // Clear navigation when search query is cleared
  useEffect(() => {
    if (!searchQuery) {
      handleClearSearch();
    }
  }, [searchQuery, handleClearSearch]);

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
      handleClearSearch();
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
  }, [selectedRoom?.id, setMessages, isLoading, handleClearSearch]);

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

  // Filter messages - ALWAYS show only searched messages when search query exists
  const displayMessages = useMemo(() => {
    const currentRoomId = selectedRoom?.id;
    if (!messages.length || !currentRoomId) return [];
    
    // Get base room messages
    const roomMessages = messages
      .filter(msg => msg.room_id === currentRoomId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // When search query exists, ALWAYS show ONLY matching messages
    if (searchQuery && searchQuery.trim().length > 0) {
      return searchResults.length > 0 ? searchResults : [];
    }

    // No search query: show all room messages
    return roomMessages;
  }, [messages, selectedRoom?.id, searchQuery, searchResults]);

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

  // Enhanced empty state with search context - REMOVED empty state rendering
  const renderEmptyState = () => {
    // Don't render empty state when searching
    if (searchQuery && displayMessages.length === 0) {
      return null; // Don't show any empty state when searching
    }

    // Don't render empty state for normal mode either
    return null;
  };

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
     
{!isSearchExpanded && (
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
)}
      {/* Search Info Header */}
      {showSearchInfo && searchQuery && (
        <div className="px-4 py-3 border-b bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 transition-all duration-300">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>
                Showing {displayMessages.length} results for &quot;{searchQuery}&quot;
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="h-6 px-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area - Will show ONLY searched messages when searching */}
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
          ) : displayMessages.length > 0 ? (
            displayMessages.map((message) => (
              <Message 
                key={message.id} 
                message={message} 
                isNavigated={currentNavigatedMessageId === message.id}
                searchQuery={searchQuery} // Always pass searchQuery for highlighting
              />
            ))
          ) : (
            // Don't render empty state - just show nothing
            renderEmptyState()
          )}
        </div>
      </div>

      {/* Typing Indicator - Hide when searching */}
      {!searchQuery && <TypingIndicator />}

      {/* New messages notification - Hide when searching */}
      {!searchQuery && notification > 0 && (
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