"use client";

import { Imessage, transformApiMessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Database } from "@/lib/types/supabase";
import { useSelectedRoom } from "@/lib/store/unified-roomstore";
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [currentNavigatedMessageId, setCurrentNavigatedMessageId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Imessage[]>([]);
  const [showSearchInfo, setShowSearchInfo] = useState(false);

  const selectedRoom = useSelectedRoom();
  const {
    messages,
    setActiveRoom,
    loadInitialMessages,
    subscribeToRoom,
    unsubscribeFromRoom,
  } = useMessage((state) => ({
    messages: state.messages,
    setActiveRoom: state.setActiveRoom,
    loadInitialMessages: state.loadInitialMessages,
    subscribeToRoom: state.subscribeToRoom,
    unsubscribeFromRoom: state.unsubscribeFromRoom,
  }));

  const { setHighlightedMessageId } = useSearchHighlight();
  const supabase = getSupabaseBrowserClient();
  const prevRoomIdRef = useRef<string | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchEngineRef = useRef<MessageSearchEngine>(new MessageSearchEngine());

  /* --------------------------------------------------------------------------
     CSS VARIABLES STYLES
  -------------------------------------------------------------------------- */
  const messageStyles = useMemo(() => ({
    // Layout & Spacing
    containerHeight: 'calc(100dvh * 0.75)', // 75dvh of viewport
    padding: 'var(--layout-gap, 1rem)',
    gap: 'var(--layout-gap, 1rem)',
    borderRadius: 'var(--radius-unit, 0.5rem)',
    
    // Typography
    fontSize: 'var(--chat-message-size, calc(1rem * var(--chat-font-scale, 1.1)))',
    fontFamily: 'var(--font-family-base, "Inter", system-ui, sans-serif)',
    lineHeight: 'var(--lh-normal, 1.4)',
    
    // Colors
    backgroundColor: 'hsl(var(--background))',
    foregroundColor: 'hsl(var(--foreground))',
    messageTextColor: 'hsl(var(--message-text-color))',
    mutedForeground: 'hsl(var(--muted-foreground))',
    
    // Message bubble
    bubbleRadius: 'var(--message-bubble-radius, 1.25rem)',
    bubblePadding: 'var(--message-bubble-padding, 0.75rem 1rem)',
    messageGap: 'var(--message-gap, 0.5rem)',
    
    // Sender & Date info
    senderSize: 'var(--message-sender-size, 0.875rem)',
    dateSize: 'var(--message-date-size, 0.75rem)',
    senderColor: 'hsl(var(--message-sender-color))',
    dateColor: 'hsl(var(--message-date-color))',
    
    // No messages state
    noMessagesColor: 'hsl(var(--no-messages-color))',
    noMessagesSize: 'var(--no-messages-size, 1em)',
    
    // Search UI
    searchInfoBg: 'hsl(var(--accent))',
    searchInfoText: 'hsl(var(--accent-foreground))',
    searchHighlightBg: 'rgba(59, 130, 246, 0.3)', // Search highlight color
    
    // Buttons & Interactions
    buttonSize: 'var(--spacing-unit, 1rem)',
    iconSize: 'calc(var(--spacing-unit, 1rem) * 1.25)',
    hoverOpacity: '0.85',
    activeScale: '0.95',
    
    // Glass Effects
    glassOpacity: 'var(--glass-opacity, 0.75)',
    glassBlur: 'var(--glass-blur, 16px)',
    borderOpacity: 'var(--border-opacity, 0.15)',
    
    // Responsive breakpoints
    breakpointSm: '480px',
    breakpointMd: '768px',
    breakpointLg: '1024px',
    
    // Animation
    transitionDuration: 'var(--motion-duration, 200ms)',
    transitionEasing: 'var(--motion-easing, cubic-bezier(0.2, 0, 0, 1))',
  }), []);

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
        // Clear and re-index only if needed
        const currentCount = searchEngineRef.current.getMessageCount();
        if (currentCount !== roomMessages.length) {
          searchEngineRef.current.clear();
          roomMessages.forEach(msg => {
            searchEngineRef.current.indexMessage(msg);
          });
        }
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

  // Load initial messages - FIXED: Use the store's loadInitialMessages instead of setMessages
  useEffect(() => {
    const currentRoomId = selectedRoom?.id;

    if (!currentRoomId) {
      setActiveRoom(null);
      unsubscribeFromRoom();
      setInitialLoadComplete(false);
      return;
    }

    const roomChanged = currentRoomId !== prevRoomIdRef.current;

    if (roomChanged) {
      setActiveRoom(null);
      setInitialLoadComplete(false);
      handleClearSearch();
      prevRoomIdRef.current = currentRoomId;
      
      // Show skeleton immediately on room change
      setIsLoading(true);
    }

    // Clear any existing timeout and abort controller
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Set loading state with a small delay to prevent flicker
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoading(true);
    }, 50);

    // Use the store's loadInitialMessages method
    const loadMessages = async () => {
      try {
        await loadInitialMessages(currentRoomId, { force: roomChanged });
        setInitialLoadComplete(true);
      } catch (error: any) {
        // Don't log abort errors
        if (error.name !== 'AbortError') {
          console.error("Load messages error:", error);
        }
      } finally {
        setIsLoading(false);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        abortControllerRef.current = null;
      }
    };

    loadMessages();

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [selectedRoom?.id, setActiveRoom, handleClearSearch, loadInitialMessages, unsubscribeFromRoom]);

  // Real-time subscription
  useEffect(() => {
    const currentRoomId = selectedRoom?.id;
    if (!currentRoomId) return;

    subscribeToRoom(currentRoomId);

    return () => {
      unsubscribeFromRoom();
    };
  }, [selectedRoom?.id, subscribeToRoom, unsubscribeFromRoom]);

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

  // Show skeleton only when loading AND no messages are displayed yet
  const showSkeleton = isLoading && displayMessages.length === 0;

  const SkeletonMessage = React.memo(() => (
    <div 
      className="flex gap-2 w-full p-2"
      style={{ gap: messageStyles.messageGap }}
    >
      <div 
        className="rounded-full flex-shrink-0 animate-pulse"
        style={{
          width: messageStyles.iconSize,
          height: messageStyles.iconSize,
          backgroundColor: `hsl(${messageStyles.mutedForeground} / 0.3)`,
        }}
      />
      <div className="flex-1 space-y-2 min-w-0">
        <div 
          className="rounded animate-pulse"
          style={{
            height: messageStyles.senderSize,
            backgroundColor: `hsl(${messageStyles.mutedForeground} / 0.3)`,
            width: '25%',
          }}
        />
        <div 
          className="rounded animate-pulse break-all"
          style={{
            height: messageStyles.dateSize,
            backgroundColor: `hsl(${messageStyles.mutedForeground} / 0.3)`,
            width: '75%',
          }}
        />
      </div>
    </div>
  ));

  SkeletonMessage.displayName = "SkeletonMessage";

  // Enhanced empty state with search context
  const renderEmptyState = useMemo(() => {
    // Don't render empty state when searching
    if (searchQuery && displayMessages.length === 0) {
      return (
        <div 
          className="flex flex-col items-center justify-center h-48 text-center"
          style={{
            color: messageStyles.noMessagesColor,
            fontSize: messageStyles.noMessagesSize,
          }}
        >
          <Search style={{ width: '2rem', height: '2rem', marginBottom: '1rem' }} />
          <p>No messages found for {searchQuery}</p>
        </div>
      );
    }

    // Don't render empty state when loading
    if (isLoading) {
      return null;
    }

    // Show empty state for normal mode
    if (displayMessages.length === 0 && initialLoadComplete) {
      return (
        <div 
          className="flex flex-col items-center justify-center h-48 text-center"
          style={{
            color: messageStyles.noMessagesColor,
            fontSize: messageStyles.noMessagesSize,
          }}
        >
          <p>No messages yet. Start the conversation!</p>
        </div>
      );
    }

    return null;
  }, [searchQuery, displayMessages.length, isLoading, initialLoadComplete, messageStyles]);

  if (!selectedRoom?.id) {
    return (
      <div
        className="flex items-center justify-center h-full overflow-hidden"
        style={{
          color: messageStyles.noMessagesColor,
          fontSize: messageStyles.noMessagesSize,
          fontFamily: messageStyles.fontFamily,
        }}
      >
        <p>Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex flex-col overflow-hidden relative"
      style={{
        height: messageStyles.containerHeight,
        backgroundColor: messageStyles.backgroundColor,
        color: messageStyles.foregroundColor,
        fontFamily: messageStyles.fontFamily,
        fontSize: `calc(${messageStyles.fontSize} * var(--app-font-scale, 1))`,
        transition: `all ${messageStyles.transitionDuration} ${messageStyles.transitionEasing}`,
      }}
    >

      {!isSearchExpanded && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSearchTrigger}
          className={cn(
            "absolute top-4 right-4 z-30 flex items-center justify-center rounded-full",
            "transition-all duration-300 ease-in-out group hover:bg-[hsl(var(--action-active))]/15 active:scale-95",
            "focus-visible:ring-[hsl(var(--action-ring))]/50 focus-visible:ring-2"
          )}
          style={{
            width: messageStyles.iconSize,
            height: messageStyles.iconSize,
            backgroundColor: `hsl(${messageStyles.backgroundColor}) / ${messageStyles.glassOpacity}`,
            backdropFilter: `blur(${messageStyles.glassBlur})`,
            boxShadow: `0 4px 16px hsl(0 0% 0% / var(--shadow-strength, 0.12))`,
            border: `1px solid hsl(${messageStyles.foregroundColor} / ${messageStyles.borderOpacity})`,
          }}
          title="Search Messages"
        >
          <Search 
            className="transition-all duration-300"
            style={{
              width: `calc(${messageStyles.iconSize} * 0.6)`,
              height: `calc(${messageStyles.iconSize} * 0.6)`,
              color: `hsl(${messageStyles.mutedForeground})`,
            }}
          />
        </Button>
      )}
      
      {/* Search Info Header */}
      {showSearchInfo && searchQuery && (
        <div 
          className="px-4 py-3 border-b transition-all duration-300"
          style={{
            backgroundColor: messageStyles.searchInfoBg,
            color: messageStyles.searchInfoText,
            borderColor: `hsl(${messageStyles.foregroundColor} / ${messageStyles.borderOpacity})`,
          }}
        >
          <div 
            className="flex items-center justify-between"
            style={{ fontSize: messageStyles.senderSize }}
          >
            <div className="flex items-center gap-2">
              <Search 
                style={{
                  width: `calc(${messageStyles.iconSize} * 0.5)`,
                  height: `calc(${messageStyles.iconSize} * 0.5)`,
                }}
              />
              <span>
                Showing {displayMessages.length} results for &quot;{searchQuery}&quot;
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="hover:bg-blue-100 dark:hover:bg-blue-800/30"
              style={{
                height: `calc(${messageStyles.buttonSize} * 1.5)`,
                padding: `0 calc(${messageStyles.buttonSize} * 0.5)`,
                fontSize: messageStyles.dateSize,
              }}
            >
              <X 
                className="mr-1"
                style={{
                  width: `calc(${messageStyles.iconSize} * 0.375)`,
                  height: `calc(${messageStyles.iconSize} * 0.375)`,
                }}
              />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area - Will show ONLY searched messages when searching */}
      <div
        ref={scrollRef}
        onScroll={handleOnScroll}
        className=""
        style={{
          paddingLeft: `calc(${messageStyles.padding} * 0.75)`,
          paddingRight: `calc(${messageStyles.padding} * 0.75)`,
          gap: messageStyles.messageGap,
          scrollbarColor: `hsl(${messageStyles.mutedForeground} / 0.3) transparent`,
        }}
      >
        <div className="w-full h-[75vh] overflow-y-scroll py-2 space-y-2 scrollbar-thin">
          {showSkeleton ? (
            <div 
              className="space-y-4"
              style={{ gap: messageStyles.gap }}
            >
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
                searchQuery={searchQuery}
              />
            ))
          ) : (
            // Render empty state when no messages
            renderEmptyState
          )}
        </div>
      </div>

      {/* Typing Indicator - Hide when searching */}
      {!searchQuery && <TypingIndicator />}

      {/* New messages notification - Hide when searching */}
      {!searchQuery && notification > 0 && (
        <div 
          className="absolute z-10"
          style={{
            bottom: `calc(${messageStyles.buttonSize} * 5)`,
            right: messageStyles.buttonSize,
          }}
        >
          <button
            onClick={scrollDown}
            className="shadow-lg hover:bg-blue-700 transition-colors text-sm rounded-lg"
            style={{
              backgroundColor: `hsl(var(--primary))`,
              color: `hsl(var(--primary-foreground))`,
              padding: `${messageStyles.buttonSize} calc(${messageStyles.buttonSize} * 1.5)`,
              fontSize: messageStyles.senderSize,
              borderRadius: messageStyles.borderRadius,
            }}
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