"use client";

import { Imessage,  useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { useSelectedRoom } from "@/lib/store/unified-roomstore";
import TypingIndicator from "./TypingIndicator";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchHighlight } from "@/lib/store/SearchHighlightContext";
import "./list-messsages.css"; // plain CSS (global). keep file name exactly as in your project
import RoomAssistantPopover from "@/components/RoomAssistantPopover";

interface ListMessagesProps {
  searchQuery?: string;
  isSearching?: boolean;
  onSearchStateChange?: (searching: boolean) => void;
  onSearchTrigger?: () => void;
  isSearchExpanded?: boolean;
}

/* MessageSearchEngine (kept as you provided). If you moved it elsewhere, import it. */
class MessageSearchEngine {
  private invertedIndex: Map<string, Set<string>> = new Map();
  private messages: Map<string, Imessage> = new Map();
  private characterIndex: Map<string, Set<string>> = new Map();

  indexMessage(message: Imessage) {
    this.messages.set(message.id, message);
    const words = this.tokenize(message.text || "");

    for (const word of words) {
      if (!this.invertedIndex.has(word)) {
        this.invertedIndex.set(word, new Set());
      }
      this.invertedIndex.get(word)!.add(message.id);
    }
    this.indexCharacterSequences(message.id, message.text || "");
  }

  private indexCharacterSequences(messageId: string, text: string) {
    const cleanText = text.toLowerCase();
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
    for (const [word, messageIds] of Array.from(this.invertedIndex.entries())) {
      messageIds.delete(messageId);
      if (messageIds.size === 0) this.invertedIndex.delete(word);
    }
    for (const [seq, messageIds] of Array.from(this.characterIndex.entries())) {
      messageIds.delete(messageId);
      if (messageIds.size === 0) this.characterIndex.delete(seq);
    }
  }

  search(query: string): Imessage[] {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return [];

    const lowerQuery = query.toLowerCase();
    let results: Set<string> = new Set();

    for (const [sequence, messageIds] of this.characterIndex.entries()) {
      if (lowerQuery.includes(sequence) || sequence.includes(lowerQuery)) {
        messageIds.forEach(id => results.add(id));
      }
    }

    for (const word of queryWords) {
      const wordResults = this.invertedIndex.get(word);
      if (wordResults) wordResults.forEach(id => results.add(id));
    }

    for (const [id, message] of this.messages.entries()) {
      if ((message.text || "").toLowerCase().includes(lowerQuery)) results.add(id);
    }

    if (results.size === 0) return [];

    return Array.from(results)
      .map(id => this.messages.get(id))
      .filter((m): m is Imessage => !!m)
      .sort((a, b) => {
        return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
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
  const prevRoomIdRef = useRef<string | null>(null);
  const loadTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchEngineRef = useRef<MessageSearchEngine>(new MessageSearchEngine());
  const indexedIdsRef = useRef<Set<string>>(new Set());

  const ITEM_GUESS_HEIGHT = 88;

  /* ----------------------
     Helpers
  ---------------------- */
  const handleOnScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const sc = scrollRef.current;
    const { scrollTop, scrollHeight, clientHeight } = sc;
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

  const scrollToMessage = useCallback((messageId: string, behavior: ScrollBehavior = "smooth") => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior, block: "center" });
    }
  }, []);

  /* ----------------------
     Incremental indexing (idle)
  ---------------------- */
  useEffect(() => {
    if (!selectedRoom?.id) return;
    const roomMessages = messages.filter(m => m.room_id === selectedRoom.id);
    if (roomMessages.length === 0) return;

    const toIndex = roomMessages.filter(m => !indexedIdsRef.current.has(m.id));
    if (toIndex.length === 0) return;

    const doIndex = () => {
      try {
        for (const m of toIndex) {
          searchEngineRef.current.indexMessage(m);
          indexedIdsRef.current.add(m.id);
        }
      } catch (err) {
        console.error("index error", err);
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(doIndex, { timeout: 500 });
    } else {
      setTimeout(doIndex, 150);
    }
  }, [messages, selectedRoom?.id]);

  /* ----------------------
     Debounced search (client)
  ---------------------- */
  const searchTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowSearchInfo(false);
      setHighlightedMessageId(null);
      setCurrentNavigatedMessageId(null);
      onSearchStateChange?.(false);
      return;
    }

    onSearchStateChange?.(true);
    setShowSearchInfo(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      try {
        const results = searchEngineRef.current.search(searchQuery);
        setSearchResults(results);
        if (results.length > 0) {
          setHighlightedMessageId(results[0].id);
          setCurrentNavigatedMessageId(results[0].id);
          setTimeout(() => scrollToMessage(results[0].id, "smooth"), 50);
        } else {
          setHighlightedMessageId(null);
          setCurrentNavigatedMessageId(null);
        }
      } catch (err) {
        console.error("search error", err);
        setSearchResults([]);
      } finally {
        onSearchStateChange?.(false);
      }
    }, 140);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchResults([]);
    setHighlightedMessageId(null);
    setCurrentNavigatedMessageId(null);
    setShowSearchInfo(false);
    onSearchStateChange?.(false);
  }, [setHighlightedMessageId, onSearchStateChange]);

  /* ----------------------
     Load initial messages & room change
  ---------------------- */
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
      setIsLoading(true);
      indexedIdsRef.current.clear();
      searchEngineRef.current.clear();
    }

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    loadTimeoutRef.current = setTimeout(() => setIsLoading(true), 50);

    const loadMessages = async () => {
      const t0 = performance.now();
      try {
        await loadInitialMessages(currentRoomId!, { force: roomChanged });
        setInitialLoadComplete(true);
      } catch (error: any) {
        if (error?.name !== "AbortError") console.error("Load messages error:", error);
      } finally {
        setIsLoading(false);
        if (loadTimeoutRef.current) { clearTimeout(loadTimeoutRef.current); loadTimeoutRef.current = null; }
        abortControllerRef.current = null;
        const t1 = performance.now();
        // instrumentation - optionally log or send to telemetry
        // console.log(`loadInitialMessages ${Math.round(t1 - t0)}ms`);
      }
    };

    loadMessages();

    return () => {
      if (loadTimeoutRef.current) { clearTimeout(loadTimeoutRef.current); loadTimeoutRef.current = null; }
      if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    };
  }, [selectedRoom?.id, setActiveRoom, handleClearSearch, loadInitialMessages, unsubscribeFromRoom]);

  /* ----------------------
     Realtime subscription
  ---------------------- */
  useEffect(() => {
    const currentRoomId = selectedRoom?.id;
    if (!currentRoomId) return;
    subscribeToRoom(currentRoomId);
    return () => unsubscribeFromRoom();
  }, [selectedRoom?.id, subscribeToRoom, unsubscribeFromRoom]);

  /* ----------------------
     Auto-scroll when new messages arrive
  ---------------------- */
  const prevMessagesLen = useRef(messages.length);
  useEffect(() => {
    if (!scrollRef.current || !selectedRoom?.id) return;
    const isNewMessage = prevMessagesLen.current < messages.length;
    const isRoomChanged = selectedRoom.id !== prevRoomIdRef.current;

    if (isRoomChanged) {
      scrollRef.current.scrollTop = 0;
      prevRoomIdRef.current = selectedRoom.id;
    } else if (isNewMessage && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    prevMessagesLen.current = messages.length;
  }, [messages.length, userScrolled, selectedRoom?.id]);

  /* ----------------------
     Filter messages for current room / search
  ---------------------- */
  const displayMessages = useMemo(() => {
    const currentRoomId = selectedRoom?.id;
    if (!messages.length || !currentRoomId) return [];

    const roomMessages = messages
      .filter(msg => msg.room_id === currentRoomId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (searchQuery && searchQuery.trim().length > 0) {
      return searchResults.length > 0 ? searchResults : [];
    }

    return roomMessages;
  }, [messages, selectedRoom?.id, searchQuery, searchResults]);

  const showSkeleton = isLoading && displayMessages.length === 0;

  /* ----------------------
     Animated skeleton element
  ---------------------- */
  const SkeletonMessage = useCallback(() => (
    <div className="lm-skeletonRow">
      <div className="lm-skeletonAvatar" />
      <div className="lm-skeletonContent">
        <div className="lm-skeletonLineShort" />
        <div className="lm-skeletonLineLong" />
      </div>
    </div>
  ), []);

  const renderEmptyState = useMemo(() => {
    if (searchQuery && displayMessages.length === 0) {
      return (
        <div className="lm-emptyState">
          <Search className="lm-emptyIcon" />
          <p>No messages found for {searchQuery}</p>
        </div>
      );
    }
    if (isLoading) return null;
    if (displayMessages.length === 0 && initialLoadComplete) {
      return (
        <div className="lm-emptyState">
          <p>No messages yet. Start the conversation!</p>
        </div>
      );
    }
    return null;
  }, [searchQuery, displayMessages.length, isLoading, initialLoadComplete]);

  if (!selectedRoom?.id) {
    return (
      <div className="lm-centerEmpty" role="status">
        <p>Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div className="lm-container" style={{ fontFamily: 'var(--font-family-base, Inter, system-ui, sans-serif)' }}>
      {/* search trigger */}
      {!isSearchExpanded && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchTrigger}
          className={cn("lm-searchButton", "group")}
          title="Search Messages"
        >
          <Search />
        </Button>
      )}

      {/* search info */}
      {showSearchInfo && searchQuery && (
        <div className="lm-searchInfo">
          <div className="lm-searchInfoInner">
            <div className="lm-searchInfoLeft">
              <Search />
              <span>Showing {displayMessages.length} results for &quot;{searchQuery}&quot;</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearSearch} className="lm-clearBtn">
              <X className="mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* messages scroll area */}
      <div className="lm-scrollWrapper " ref={scrollRef} onScroll={handleOnScroll} tabIndex={0}>
        <div className="lm-messagesInner ">
          {showSkeleton ? (
            <div className="lm-skeletonList">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonMessage key={i} />)}
            </div>
          ) : displayMessages.length > 0 ? (
            displayMessages.map((message) => (
              <div key={message.id} className="lm-messageRow ">
                <Message
                  message={message}
                  isNavigated={currentNavigatedMessageId === message.id}
                  searchQuery={searchQuery}
                />
              </div>
            ))
          ) : (
            renderEmptyState
          )}
         
{selectedRoom && (
  <RoomAssistantPopover
    roomId={selectedRoom.id}
    roomName={selectedRoom.name ?? ""}
  />
)}
        </div>
      </div>

      {/* typing indicator */}
      {!searchQuery && <TypingIndicator />}

      {/* new messages notification */}
      {!searchQuery && notification > 0 && (
        <div className="lm-newMsgBtn">
          <button onClick={scrollDown} className="lm-newMsgBtnInner" title="Scroll to latest messages">
            {notification} new message{notification > 1 ? 's' : ''} ↓
          </button>
        </div>
      )}

      <DeleteAlert />
      <EditAlert />
    </div>
  );
}
