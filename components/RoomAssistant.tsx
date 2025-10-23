// RoomAssistant.tsx - Fully optimized single-file version (No streaming, HTML auto-expand, stable scroll)
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Loader2,
  Send,
  X,
  Copy,
  RefreshCw,
  Download,
  Trash2,
  AlertCircle,
  MoreVertical,
  Sparkles,
  Mic,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useMessage, type Imessage } from "@/lib/store/messages";
import { useRoomContext } from "@/lib/store/RoomContext";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DOMPurify from "dompurify";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { estimateTokens } from "@/lib/token-utils";

// ----------------------------- Types ---------------------------------
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  isPersisted?: boolean;
  metadata?: {
    tokenCount?: number;
    messageCount?: number;
  };
}

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  maxPromptLength?: number;
  maxHistory?: number;
  initialModel?: string;
}

// ----------------------------- Helpers --------------------------------
const generateId = (): string => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const sanitizeHtml = (html: string) => {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "div",
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "strong",
      "em",
      "b",
      "i",
      "a",
      "br",
      "hr",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["class", "style", "href", "target", "rel", "scope"],
    KEEP_CONTENT: true,
  });
};

// Lightweight token counting wrapper (matches your server util)
const countTokens = (text: string) => estimateTokens(text);

// ------------------------- ChatMessageDisplay --------------------------
// Memoized message item to avoid re-renders when unrelated messages change.
type ChatMessageDisplayProps = {
  msg: ChatMessage;
  copyToClipboard: (content: string) => void;
  theme: "light" | "dark";
  onExpand?: (msgId: string | null) => void;
};

const ChatMessageDisplay = React.memo(function ChatMessageDisplay({
  msg,
  copyToClipboard,
  theme,
  onExpand,
}: ChatMessageDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const safeTimestamp = useMemo(() => {
    try {
      return new Date(msg.timestamp);
    } catch {
      return new Date();
    }
  }, [msg.timestamp]);

  const formattedTime = useMemo(
    () => safeTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [safeTimestamp]
  );

  const isUserMessage = msg.role === "user";
  const isAssistantMessage = msg.role === "assistant";
  const isHtmlContent = useMemo(
    () => isAssistantMessage && /<[^>]+>/i.test(msg.content),
    [msg.content, isAssistantMessage]
  );

  const shouldTruncate = !isHtmlContent && msg.content.length > 800 && !isExpanded;
  const displayContent = shouldTruncate ? `${msg.content.slice(0, 800)}...` : msg.content;

  const handleExpandToggle = useCallback(() => {
    setIsExpanded((s) => !s);
    if (!isExpanded && onExpand) onExpand(msg.id);
    if (isExpanded && onExpand) onExpand(null);
  }, [isExpanded, onExpand, msg.id]);

  const renderContent = useMemo(() => {
    if (isHtmlContent) {
      const cleanHtml = sanitizeHtml(msg.content);
      return (
        <div className="w-full">
          <div 
            className={cn(
              "w-full max-w-none", // Force full width
              "prose prose-sm max-w-none",
              "whitespace-pre-wrap leading-relaxed text-sm",
              // Remove restrictive container classes
              theme === "dark" 
                ? "text-white [&_th]:text-white [&_td]:text-white"
                : "text-black [&_th]:text-black [&_td]:text-black"
            )}
            dangerouslySetInnerHTML={{ __html: cleanHtml }} 
          />
        </div>
      );
    } else {
      return (
        <div className="w-full">
          <div className="whitespace-pre-wrap leading-relaxed text-sm max-w-none">{displayContent}</div>
          {shouldTruncate && (
            <Button
              variant="link"
              className="p-0 h-auto text-primary/80 hover:text-primary mt-2 text-xs"
              onClick={handleExpandToggle}
            >
              Show more
            </Button>
          )}
        </div>
      );
    }
  }, [isHtmlContent, msg.content, displayContent, shouldTruncate, theme, handleExpandToggle]);
  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn("flex w-full group", isUserMessage ? "justify-end" : "justify-start")}
    >
      <Card
          className={cn(
            "relative w-full transition-all duration-200 max-w-none", // Add max-w-none
            isUserMessage
              ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
              : "bg-background/80 border-border/50"
          )}
        >
        <CardContent className="p-3 sm:p-4 ">
          <div className="whitespace-pre-wrap leading-relaxed h-auto max-w-none">{renderContent}</div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-current/20">
            <span
              className={`text-xs font-medium ${isUserMessage ? "text-primary-foreground/90" : "text-muted-foreground/80"}`}
            >
              {isUserMessage ? "You" : `AI • ${msg.model || "Model"}`}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isUserMessage ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>
                {formattedTime}
              </span>

              {isAssistantMessage && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(msg.content)}
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-accent/50"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <p>Copy message</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// ------------------------- Main Component ------------------------------
export default function RoomAssistant({
  roomId,
  roomName,
  className = "",
  maxPromptLength = 500,
  maxHistory = 50,
  initialModel = "gpt-3.5-turbo",
}: RoomAssistantProps) {
  // State
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false); // unused for live updates, kept for UI parity
  const [model, setModel] = useState(initialModel);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Refs for scrolling and user interaction
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<number | null>(null);

  // External hooks/context
  const { messages: allMessages } = useMessage();
  const { addMessage, state: roomState } = useRoomContext();
  const { theme: systemTheme, setTheme: setSystemTheme } = useTheme();
  const theme = systemTheme === "dark" ? "dark" : "light";

  // --- Utilities ---
  const copyToClipboard = useCallback((content: string) => {
    const textContent = content.replace(/<[^>]*>/g, "");
    navigator.clipboard
      .writeText(textContent)
      .then(() => toast.success("Copied to clipboard!"))
      .catch(() => toast.error("Failed to copy"));
  }, []);

  const saveToLocal = useCallback(
    (newMessages: ChatMessage[]) => {
      try {
        const key = `ai-chat-${roomId}`;
        const messagesToSave = newMessages
          .filter((m) => !m.isPersisted)
          .slice(-maxHistory)
          .map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
        localStorage.setItem(key, JSON.stringify(messagesToSave));
      } catch (err) {
        console.error("Failed to save to local storage:", err);
      }
    },
    [roomId, maxHistory]
  );

  const loadFromLocalStorage = useCallback(() => {
    try {
      const key = `ai-chat-${roomId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          content: String(m.content || ""),
          isPersisted: false,
        }));
        setMessages(parsed.slice(-maxHistory));
      }
    } catch (err) {
      console.error("Failed to load from localStorage:", err);
    }
  }, [roomId, maxHistory]);

  // load AI chat history from DB (if user exists)
  const loadAIChatHistory = useCallback(async () => {
    if (!roomState.user?.id) return;
    try {
      const res = await fetch(`/api/ai-chat/history?roomId=${roomId}&userId=${roomState.user.id}`);
      if (res.ok) {
        const history = await res.json();
        const chatMessages: ChatMessage[] = history.map((item: any) => ({
          id: item.id,
          role: "assistant",
          content: item.ai_response,
          timestamp: new Date(item.created_at),
          model: item.model_used,
          isPersisted: true,
          metadata: {
            tokenCount: item.token_count,
            messageCount: item.message_count,
          },
        }));
        setMessages((prev) => [...chatMessages.slice(-maxHistory)]);
      } else {
        loadFromLocalStorage();
      }
    } catch (err) {
      console.error("Failed to load AI chat history:", err);
      loadFromLocalStorage();
    }
  }, [roomId, roomState.user, loadFromLocalStorage, maxHistory]);

  const saveToAIChatHistory = useCallback(
    async (userQuery: string, aiResponse: string, metadata: { tokenCount?: number; messageCount?: number } = {}) => {
      if (!roomState.user?.id) return false;
      try {
        const response = await fetch("/api/ai-chat/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            user_id: roomState.user.id,
            user_query: userQuery,
            ai_response: aiResponse,
            model_used: model,
            token_count: metadata.tokenCount,
            message_count: metadata.messageCount,
          }),
        });
        return response.ok;
      } catch (err) {
        console.error("Failed to save AI chat history:", err);
        return false;
      }
    },
    [roomId, roomState.user, model]
  );

  // ----------------- Stable scroll handling -----------------
  const onUserScroll = useCallback(() => {
    userScrollingRef.current = true;
    if (userScrollTimerRef.current) {
      window.clearTimeout(userScrollTimerRef.current);
    }
    // stop considering user scrolling after 1s of inactivity
    userScrollTimerRef.current = window.setTimeout(() => {
      userScrollingRef.current = false;
      userScrollTimerRef.current = null;
    }, 1000);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    // Respect user manual scroll (especially for horizontal scroll)
    if (userScrollingRef.current) return;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    } else if (scrollContainerRef.current) {
      // fallback: scroll to bottom of container
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // ----------------- Build recentRoomMessages for context -----------------
  const recentRoomMessages = useMemo(() => {
    return allMessages
      .filter((msg: Imessage) => msg.room_id === roomId)
      .slice(-60)
      .map((msg: Imessage) => {
        const sender = msg.profiles?.display_name || msg.profiles?.username || "User";
        return `${sender}: ${msg.text}`;
      })
      .join("\n");
  }, [allMessages, roomId]);

  // ----------------- API call (No streaming) -----------------
  // Robust client-side handling: if server supports streaming, read entire stream and assemble final; if JSON, use that.
  const callSummarizeApi = useCallback(
    async (contextPrompt: string) => {
      // set up request body
      const body = {
        prompt: contextPrompt,
        roomId,
        model,
        // signal to server we prefer non-streaming if supported
        disable_stream: true,
      };

      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          let payload: any;
          try {
            payload = await res.json();
          } catch {
            throw new Error(`HTTP ${res.status}`);
          }
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }

        const contentType = res.headers.get("content-type") || "";

        // If server returned JSON (preferred), parse and extract final content
        if (contentType.includes("application/json")) {
          const data = await res.json();
          // Support multiple possible shapes
          const final = data.fullContent || data.ai_response || data.result || data.text || "";
          return { content: String(final || ""), persisted: !!data.persisted, metrics: data.metrics || {} };
        }

        // If server returned text/event-stream or other streaming format, read & assemble end event
        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
          let done = false;
          while (!done) {
            const { value, done: readDone } = await reader.read();
            if (readDone) {
              done = true;
              break;
            }
            accumulated += decoder.decode(value, { stream: true });
          }
          // Try to parse known SSE `data: { ... }` blocks and extract final 'end' or 'fullContent'
          // Fallback: return accumulated raw text
          try {
            // find last JSON object in stream
            const matches = Array.from(accumulated.matchAll(/data:\s*({[\s\S]*?})\s*\n\n/g));
            if (matches.length > 0) {
              const last = matches[matches.length - 1][1];
              const parsed = JSON.parse(last);
              const final = parsed.fullContent || parsed.full_content || parsed.final || parsed.content || "";
              return { content: String(final || accumulated), persisted: !!parsed.persisted, metrics: parsed.metrics || {} };
            }
          } catch (err) {
            // ignore parse error and return raw text
            console.warn("Failed to parse SSE JSON, returning raw text", err);
          }
          return { content: accumulated, persisted: false, metrics: {} };
        }

        // otherwise fallback
        return { content: "", persisted: false, metrics: {} };
      } catch (err: any) {
        throw err;
      }
    },
    [roomId, model]
  );

  // ----------------- Submit handler (no streaming) -----------------
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!prompt.trim() || !roomState.user) {
        toast.error("Please log in and enter a query.");
        return;
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };

      // Append user message locally
      setMessages((prev) => {
        const next = [...prev.slice(-maxHistory + 1), userMsg];
        return next;
      });

      setPrompt("");
      setLoading(true);
      setError(null);
      setIsStreaming(false); // no streaming choice

      // Build context for server
      const historyStr =
        messages.map((m) => `${m.role}: ${m.content}`).join("\n") + `\nuser: ${prompt}`;
      const context = recentRoomMessages
        ? `Room "${roomName}" recent messages:\n${recentRoomMessages}\n\nChat History:\n${historyStr}`
        : `Room "${roomName}"\n\nChat History:\n${historyStr}`;

      try {
        // call API (non-streaming preferred)
        const { content: fullResponse, persisted, metrics } = await callSummarizeApi(context);

        // Create assistant message and persist
        const aiMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: fullResponse || "No response received.",
          timestamp: new Date(),
          model,
          isPersisted: Boolean(persisted),
          metadata: {
            tokenCount: metrics?.outputTokens || Math.floor((fullResponse || "").length / 4),
            messageCount: messages.length + 1,
          },
        };

        // Atomic update: append assistant message
        setMessages((prev) => {
          const next = [...prev, aiMsg].slice(-maxHistory);
          // persist to local if DB not persisted
          if (!aiMsg.isPersisted) saveToLocal(next);
          return next;
        });

        // Try to save to DB if not persisted already
        if (!aiMsg.isPersisted) {
          const saved = await saveToAIChatHistory(prompt, fullResponse || "", {
            tokenCount: aiMsg.metadata?.tokenCount,
            messageCount: aiMsg.metadata?.messageCount,
          });
          if (saved) {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsg.id ? { ...m, isPersisted: true } : m))
            );
            toast.success("Response saved to chat history!");
          } else {
            toast.warning("Saved locally - database sync failed.");
          }
        } else {
          toast.success("Response loaded from DB.");
        }

        // scroll to bottom after full response added
        setTimeout(() => scrollToBottom(true), 80);
      } catch (err: any) {
        console.error("API Error:", err);
        setError(err instanceof Error ? err.message : String(err));
        toast.error(err instanceof Error ? err.message : "Request failed");
      } finally {
        setLoading(false);
        setIsStreaming(false);
      }
    },
    [
      prompt,
      messages,
      recentRoomMessages,
      roomName,
      callSummarizeApi,
      maxHistory,
      model,
      saveToAIChatHistory,
      saveToLocal,
      roomState.user,
      scrollToBottom,
    ]
  );

  // ----------------- Other utilities -----------------
  const clearHistory = useCallback(async () => {
    if (roomState.user?.id) {
      try {
        const response = await fetch(`/api/ai-chat/history?roomId=${roomId}&userId=${roomState.user.id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          toast.success("Chat history cleared from database!");
        } else {
          throw new Error("Failed to clear from database");
        }
      } catch (err) {
        console.error("Failed to clear database history:", err);
        toast.warning("Cleared locally only");
      }
    }
    setMessages([]);
    localStorage.removeItem(`ai-chat-${roomId}`);
  }, [roomId, roomState.user]);

  const regenerate = useCallback(() => {
    const lastUserIndex = messages.slice().reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) {
      toast.error("No user message to regenerate from");
      return;
    }
    // find actual index
    const reversedIndex = messages.length - 1 - lastUserIndex;
    const lastUserMessage = messages[reversedIndex];
    setMessages((prev) => prev.slice(0, reversedIndex + 1));
    setPrompt(lastUserMessage.content);
    // call submit on next tick
    setTimeout(() => {
      handleSubmit();
    }, 0);
  }, [messages, handleSubmit]);

  const exportChat = useCallback(() => {
    const data = {
      roomId,
      roomName,
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        model: m.model,
        metadata: m.metadata,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Chat exported successfully");
  }, [messages, roomName, roomId]);

  // Voice input
  const startVoiceInput = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in your browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt((prev) => prev + transcript);
    };
    recognition.onerror = (event: any) => {
      toast.error("Voice input failed: " + event.error);
    };
    recognition.start();
  }, []);

  // Add AI conversation to regular room messages table
  const handleAddMessage = useCallback(async () => {
    if (roomState.user && prompt.trim()) {
      try {
        const supabase = supabaseBrowser();
        const { data, error } = await supabase
          .from("messages")
          .insert({
            text: `AI Assistant Query: ${prompt}`,
            room_id: roomId,
            sender_id: roomState.user.id,
            is_edited: false,
            status: "sent",
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("Message added to room chat!");
        setPrompt("");
      } catch (err) {
        console.error("Failed to add message:", err);
        toast.error("Failed to add message to room chat");
      }
    }
  }, [prompt, roomState.user, roomId]);

  // ----------------- Effects -----------------
  useEffect(() => {
    if (roomState.user?.id) loadAIChatHistory();
    else loadFromLocalStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAIChatHistory, roomState.user]);

  // Save to local when messages change and not loading
  useEffect(() => {
    if (!loading) saveToLocal(messages);
  }, [messages, loading, saveToLocal]);

  // auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // scroll to bottom when messages update (but respects user scrolling)
  useEffect(() => {
    // small delay helps DOM settle after renders
    const id = window.setTimeout(() => scrollToBottom(true), 120);
    return () => clearTimeout(id);
  }, [messages, scrollToBottom]);

  // ----------------- UI -----------------
  return (
    <Card
      className={cn(
        "flex flex-col h-full overflow-hidden",
        "bg-gradient-to-br from-background to-muted/20",
        className
      )}
    >
      <CardHeader className="pb-3 flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bot className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">AI Assistant</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  {model}
                </Badge>
                <span className="text-xs text-muted-foreground">#{roomName}</span>
              </div>
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 max-h-64 overflow-y-auto scrollbar-thin" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm">Dark Mode</span>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setSystemTheme(checked ? "dark" : "light")}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  disabled={loading || messages.length === 0}
                  className="w-full justify-start"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear History
                </Button>
                {messages.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={regenerate} disabled={loading} className="w-full justify-start">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                )}
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={exportChat} className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export Chat
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={startVoiceInput} disabled={loading} className="w-full justify-start">
                  <Mic className="h-4 w-4 mr-2" />
                  Voice Input
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddMessage}
                  disabled={!prompt.trim() || !roomState.user}
                  className="w-full justify-start"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Add to Room
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      {/* Messages area */}
      <div className="flex-1 relative h-[50vh] min-h-0 overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={onUserScroll}
          className="h-[40vh] room-assistant-scroll p-4"
          // ensure keyboard / screen readers have good focus order
          role="log"
          aria-live="polite"
        >
          <div className="space-y-4 room-assistant-ai-content">
            <AnimatePresence mode="popLayout">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <ChatMessageDisplay
                    key={msg.id}
                    msg={msg}
                    copyToClipboard={copyToClipboard}
                    theme={theme as "light" | "dark"}
                    onExpand={setExpandedMessage}
                  />
                ))
              ) : loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i}>
                      <MessageSkeleton />
                    </div>
                  ))}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 px-4"
                >
                  <motion.div
                    className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mb-4"
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
                    transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
                  >
                    <Sparkles className="h-10 w-10 text-primary" />
                  </motion.div>
                  <h3 className="font-bold text-lg mb-2">Room AI Assistant</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Ask me anything about <strong>#{roomName}</strong>. I can analyze conversations, extract insights, and help with summaries.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error box */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 p-3 bg-destructive/10 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm">{error}</span>
            <Button variant="ghost" size="icon" onClick={() => setError(null)} className="ml-auto h-6 w-6">
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        )}

        {/* Streaming / processing indicator (kept for UX parity) */}
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-2 left-4 right-4"
            >
              <div className="bg-primary/10 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1">
                  <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                </div>
                <span className="text-xs text-muted-foreground">AI is thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="border-t bg-card/50 backdrop-blur-sm p-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={`Ask about #${roomName}... (Ctrl + Enter to send)`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, maxPromptLength))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="min-h-[80px] resize-none pr-12"
              disabled={loading}
              maxLength={maxPromptLength}
            />
            <div className="absolute bottom-2 right-2 flex items-center space-x-2">
              <span className={`text-xs ${prompt.length > maxPromptLength * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
                {prompt.length}/{maxPromptLength}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Select value={model} onValueChange={setModel} disabled={loading}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              </SelectContent>
            </Select>

            <Button type="submit" disabled={loading || !prompt.trim()} className="flex-shrink-0">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isStreaming ? "Generating..." : "Processing..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

// ------------------------- MessageSkeleton -----------------------------
function MessageSkeleton() {
  return (
    <div className="flex space-x-2 lg:space-x-3 p-3 lg:p-4">
      <Skeleton className="h-6 w-6 lg:h-8 lg:w-8 rounded-full bg-muted/50" />
      <div className="space-y-1.5 lg:space-y-2 flex-1">
        <Skeleton className="h-3 lg:h-4 w-24 lg:w-32 bg-muted/50" />
        <Skeleton className="h-12 lg:h-16 w-full bg-muted/50" />
      </div>
    </div>
  );
}
