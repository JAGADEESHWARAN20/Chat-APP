"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  memo,
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
  ChevronDown,
  Maximize2, 
  Minimize2, 
  User,
  MessageCircle,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
// import DOMPurify from "dompurify";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { estimateTokens } from "@/lib/token-utils";

// ----------------------------- Types ---------------------------------
interface StructuredAnalysis {
  type: string;
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    content: string;
    metrics: string[];
    highlights: string[];
  }>;
  keyFindings: string[];
  recommendations: string[];
  metadata: {
    participantCount: number;
    messageCount: number;
    timeRange: string;
    sentiment: string;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredData?: StructuredAnalysis;
  timestamp: Date;
  model?: string;
  isPersisted?: boolean;
  metadata?: { tokenCount?: number; messageCount?: number };
}

interface MessagePair {
  user: ChatMessage;
  assistant?: ChatMessage;
}

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  maxPromptLength?: number;
  maxHistory?: number;
  initialModel?: string;
}

// ----------------------------- Constants & Helpers --------------------------------
const MODELS = [
  "gpt-3.5-turbo", "gpt-4o-mini", "minimax/minimax-m2", "andromeda/alpha",
  "tongyi/deepresearch-30b-a3b", "meituan/longcat-flash-chat", "nvidia/nemotron-nano-9b-v2",
  "deepseek/deepseek-v3-1", "openai/gpt-oss-20b", "z-ai/glm-4-5-air",
  "qwen/qwen3-coder-480b-a35b", "moonshot/kimi-k2-0711"
] as const;

const generateId = (): string => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const countTokens = (text: string) => estimateTokens(text);

// ------------------------- Optimized StructuredRenderer --------------------------
const StructuredRenderer = memo(({ data }: { data: StructuredAnalysis }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => ({ 
      ...prev, 
      [sectionId]: !prev[sectionId] 
    }));
  }, []);

  // Memoize section rendering
  const renderedSections = useMemo(() => 
    data.sections.map((section, idx) => {
      const sectionId = `${data.type}-${idx}`;
      const isExpanded = expandedSections[sectionId];
      
      return (
        <Card key={sectionId} className="border-border/20 hover:border-primary/20 transition-colors">
          <CardHeader 
            className="p-3 pb-2 cursor-pointer" 
            onClick={() => toggleSection(sectionId)}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm flex items-center gap-1.5">
                {section.title}
              </h4>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
              </motion.div>
            </div>
          </CardHeader>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CardContent className="p-3 space-y-2 text-xs">
                  <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                  {section.metrics.length > 0 && (
                    <div className="bg-muted/30 rounded p-2">
                      <h5 className="font-medium mb-1">Metrics</h5>
                      <ul className="space-y-0.5 list-disc pl-4">
                        {section.metrics.map((m, i) => (
                          <li key={i} className="text-[10px]">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {section.highlights.length > 0 && (
                    <div className="bg-accent/20 rounded p-2">
                      <h5 className="font-medium mb-1">Highlights</h5>
                      <ul className="space-y-0.5 list-disc pl-4">
                        {section.highlights.map((h, i) => (
                          <li key={i} className="text-[10px]">{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      );
    }), 
  [data.sections, data.type, expandedSections, toggleSection]);

  if (!data.sections.length) return null;

  return (
    <div className="space-y-3 mt-3">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-muted/50 to-background/30 border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {data.title}
          </CardTitle>
          <CardDescription className="text-xs">{data.summary}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-2 text-[10px] mb-2">
            <Badge variant="outline" className="px-2 py-0.5">Users: {data.metadata.participantCount}</Badge>
            <Badge variant="outline" className="px-2 py-0.5">Msgs: {data.metadata.messageCount}</Badge>
            <Badge variant="secondary" className="px-2 py-0.5">{data.metadata.sentiment}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {renderedSections}

      {/* Memoized Findings & Recommendations */}
      {data.keyFindings.length > 0 && (
        <Card className="border-border/20">
          <CardHeader className="p-3">
            <h4 className="font-medium text-sm flex items-center gap-1.5">Key Findings</h4>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {data.keyFindings.map((f, i) => (
              <div key={i} className="bg-muted/50 rounded p-2">
                <span className="text-muted-foreground">{f}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {data.recommendations.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="p-3">
            <h4 className="font-medium text-sm flex items-center gap-1.5 text-primary">Recommendations</h4>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {data.recommendations.map((r, i) => (
              <div key={i} className="bg-primary/10 rounded p-2 border border-primary/20">
                <span className="text-primary/90">{r}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
});
StructuredRenderer.displayName = 'StructuredRenderer';

// ------------------------- Optimized PairedMessageRenderer --------------------------
const PairedMessageRenderer = memo(({ 
  pair, 
  theme,
  copyToClipboard 
}: { 
  pair: MessagePair; 
  theme: "light" | "dark";
  copyToClipboard: (content: string) => void;
}) => {
  const assistantContent = useMemo(() => {
    if (!pair.assistant) return null;
    
    if (pair.assistant.structuredData) {
      return <StructuredRenderer data={pair.assistant.structuredData} />;
    }
    
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-lg font-bold my-3 border-b border-border pb-1">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-semibold my-2">{children}</h2>,
            p: ({ children }) => <p className="my-2">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
            table: ({ children }) => (
              <div className="overflow-x-auto my-3 rounded border border-border">
                <table className="w-full border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="px-3 py-2 text-left font-semibold bg-muted text-muted-foreground border-b border-border">{children}</th>,
            td: ({ children }) => <td className="px-3 py-2 border-b border-border">{children}</td>,
            code: ({ children }) => <code className="bg-muted px-1 rounded text-xs">{children}</code>,
          }}
        >
          {pair.assistant.content}
        </ReactMarkdown>
      </div>
    );
  }, [pair.assistant]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-3"
    >
      {/* User Message */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200/50 dark:border-blue-700/50">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
              <User className="h-3 w-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 break-words">
                {pair.user.content}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {pair.user.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {pair.assistant && (
        <>
          <Separator className="my-2" />
          {/* AI Response */}
          <Card className="border-border/30 hover:border-primary/30 transition-colors shadow-sm max-h-[500px] overflow-hidden flex flex-col">
            <CardContent className="p-4 pt-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-start gap-2 mb-2 flex-shrink-0">
                <div className="w-6 h-6 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                  <Bot className="h-3 w-3 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      AI • {pair.assistant.model || "Assistant"}
                    </span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 ml-1">
                      {pair.assistant.structuredData?.type || "Analysis"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {pair.assistant.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
              
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {assistantContent}
              </div>
              
              {/* Copy button */}
              <div className="flex justify-end mt-3 pt-2 border-t border-border/30 flex-shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(pair.assistant!.content)}
                        className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-opacity hover:bg-accent/50"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy response</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
});
PairedMessageRenderer.displayName = 'PairedMessageRenderer';

// ------------------------- Main Component ------------------------------
function RoomAssistantComponent({
  roomId,
  roomName,
  className = "",
  maxPromptLength = 2000,
  maxHistory = 30,
  initialModel = "gpt-4o-mini",
}: RoomAssistantProps) {
  // State
  const [prompt, setPrompt] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState(initialModel);
  const [, startTransition] = useTransition();

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrollingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Context
  const { messages: allMessages } = useMessage();
  const { state: roomState } = useRoomContext();
  const { theme: systemTheme, setTheme } = useTheme();
  const theme = systemTheme === "dark" ? "dark" : "light";

  // ----------------- Memoized Values -----------------
  const recentRoomMessages = useMemo(() => {
    const filtered = allMessages
      .filter((msg: Imessage) => msg.room_id === roomId)
      .slice(-40)
      .map((msg: Imessage) => {
        const sender = msg.profiles?.display_name || msg.profiles?.username || "User";
        return `${sender}: ${msg.text}`.trim();
      })
      .filter(Boolean);
    return filtered.length ? filtered.join("\n") : "";
  }, [allMessages, roomId]);

  const messagePairs = useMemo<MessagePair[]>(() => {
    const pairs: MessagePair[] = [];
    let i = 0;
    
    while (i < messages.length) {
      const currentMessage = messages[i];
      
      if (currentMessage.role === "user") {
        const nextMessage = messages[i + 1];
        if (nextMessage && nextMessage.role === "assistant") {
          pairs.push({ user: currentMessage, assistant: nextMessage });
          i += 2;
        } else {
          pairs.push({ user: currentMessage });
          i += 1;
        }
      } else {
        pairs.push({ 
          user: { 
            id: generateId(), 
            role: "user" as const, 
            content: "Previous query", 
            timestamp: new Date(currentMessage.timestamp.getTime() - 1000) 
          }, 
          assistant: currentMessage 
        });
        i += 1;
      }
    }
    
    return pairs;
  }, [messages]);

  // ----------------- Optimized Callbacks -----------------
  const copyToClipboard = useCallback((content: string) => {
    const text = content.replace(/<[^>]*>/g, "").trim();
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied!"),
      () => toast.error("Copy failed")
    );
  }, []);

  const saveToLocal = useCallback((newMessages: ChatMessage[]) => {
    try {
      const key = `ai-chat-${roomId}`;
      const toSave = newMessages
        .filter((m) => !m.isPersisted)
        .slice(-maxHistory)
        .map((m) => ({ 
          ...m, 
          timestamp: m.timestamp.toISOString(), 
          structuredData: m.structuredData 
        }));
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (err) {
      console.error("Failed to save to local storage:", err);
    }
  }, [roomId, maxHistory]);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const key = `ai-chat-${roomId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          content: String(m.content),
          structuredData: m.structuredData,
          isPersisted: false,
        }));
        setMessages(parsed.slice(-maxHistory));
      }
    } catch (err) {
      console.error("Failed to load from localStorage:", err);
    }
  }, [roomId, maxHistory]);

  const loadAIChatHistory = useCallback(async () => {
    if (!roomState.user?.id) return loadFromLocalStorage();
    
    try {
      const res = await fetch(`/api/ai-chat/history?roomId=${roomId}&userId=${roomState.user.id}`);
      if (res.ok) {
        const history = await res.json();
        
        // Check if we actually got data
        if (Array.isArray(history) && history.length > 0) {
          const pairedMessages: ChatMessage[] = [];
          
          history.forEach((item: any) => {
            // Only process if we have valid data
            if (item.id && item.user_query && item.ai_response) {
              // User query message
              const userMsg: ChatMessage = {
                id: `user-${item.id}`,
                role: "user",
                content: item.user_query,
                timestamp: new Date(item.created_at),
                isPersisted: true,
              };
              
              // AI response message
              const aiMsg: ChatMessage = {
                id: item.id,
                role: "assistant",
                content: item.ai_response,
                structuredData: item.structured_data || undefined,
                timestamp: new Date(item.created_at),
                model: item.model_used || model,
                isPersisted: true,
                metadata: {
                  tokenCount: item.token_count,
                  messageCount: item.message_count,
                },
              };
              
              pairedMessages.push(userMsg, aiMsg);
            }
          });
          
          if (pairedMessages.length > 0) {
            setMessages(pairedMessages.slice(-maxHistory * 2));
            return;
          }
        }
        
        // If no valid history from API, fall back to localStorage
        console.log("No valid history from API, falling back to localStorage");
        loadFromLocalStorage();
        return;
      }
    } catch (err) {
      console.error("Failed to load AI chat history:", err);
    }
    loadFromLocalStorage();
  }, [roomId, roomState.user, loadFromLocalStorage, maxHistory, model]);

  const saveToAIChatHistory = useCallback(
    async (userQuery: string, aiResponse: string, structuredData?: StructuredAnalysis, metadata?: { tokenCount?: number; messageCount?: number }) => {
      if (!roomState.user?.id) return false;
      try {
        const res = await fetch("/api/ai-chat/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            user_id: roomState.user.id,
            user_query: userQuery,
            ai_response: aiResponse,
            structured_data: structuredData,
            analysis_type: structuredData?.type, // ADD THIS LINE
            model_used: model,
            token_count: metadata?.tokenCount,
            message_count: metadata?.messageCount,
          }),
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to save AI chat history:", errorData);
          return false;
        }
        
        const result = await res.json();
        return !!result;
      } catch (err) {
        console.error("Failed to save AI chat history:", err);
        return false;
      }
    },
    [roomId, roomState.user, model]
  );

// In your RoomAssistant component, update the callSummarizeApi function:
const callSummarizeApi = useCallback(
  async (contextPrompt: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const body = { 
      prompt: contextPrompt, 
      roomId, 
      model, 
      disable_stream: true,
      userId: roomState.user?.id // CRITICAL: Include userId
    };
    
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      return {
        content: data.fullContent || data.ai_response || "",
        structuredData: data.structuredData,
        persisted: !!data.persisted,
        metrics: data.metrics || {},
      };
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error("Request cancelled");
      throw new Error(err.message || "API failed");
    }
  },
  [roomId, model, roomState.user]
);

  // ----------------- Optimized Event Handlers -----------------
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!prompt.trim() || !roomState.user?.id) {
        toast.error("Please log in and enter a query.");
        return;
      }
  
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
  
      startTransition(() => {
        setMessages((prev) => [...prev, userMsg]);
        setPrompt("");
        setLoading(true);
        setError(null);
      });

      // Optimized token counting with early exit
      const historyText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
      const historyTokens = countTokens(historyText);
      const truncatedHistory = historyTokens > 1500
        ? messages.slice(-8).map((m) => `${m.role}: ${m.content}`).join("\n")
        : historyText;

      const contextPrompt = recentRoomMessages
        ? `Room "${roomName}" recent messages:\n${recentRoomMessages}\n\nChat History:\n${truncatedHistory}\n\nuser: ${prompt}`
        : `Room "${roomName}"\nChat History:\n${truncatedHistory}\n\nuser: ${prompt}`;

        try {
          const { content: fullResponse, structuredData, persisted, metrics } = await callSummarizeApi(contextPrompt);
    
          console.log("API Response persisted status:", persisted);
    
          const aiMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: fullResponse || "No analysis available.",
            structuredData,
            timestamp: new Date(),
            model,
            isPersisted: Boolean(persisted), // This should be true if API saved successfully
            metadata: {
              tokenCount: metrics.outputTokens || countTokens(fullResponse),
              messageCount: messages.length + 1,
            },
          };
    
          startTransition(() => {
            setMessages((prev) => {
              const updated = [...prev, aiMsg].slice(-maxHistory);
              // Only save to local storage if not persisted in database
              if (!aiMsg.isPersisted) {
                saveToLocal(updated);
              }
              return updated;
            });
          });
    
          // If API didn't persist, try to save via the history API
          if (!aiMsg.isPersisted) {
            console.log("API didn't persist, trying history API...");
            try {
              const saved = await saveToAIChatHistory(prompt, fullResponse, structuredData, aiMsg.metadata);
              if (saved) {
                startTransition(() => setMessages((prev) => 
                  prev.map((m) => m.id === aiMsg.id ? { ...m, isPersisted: true } : m)
                ));
                toast.success("Response saved to history!");
              } else {
                console.warn("Failed to save via history API, keeping locally");
                toast.warning("Saved locally - database sync failed.");
              }
            } catch (saveError) {
              console.error("Failed to save to database:", saveError);
              toast.warning("Saved locally - database sync failed.");
            }
          } else {
            toast.success("Response saved to history!");
          }
        } catch (err: any) {
          if (err.message !== "Request cancelled") {
            setError(err.message);
            toast.error(err.message);
          }
        } finally {
          setLoading(false);
          abortControllerRef.current = null;
        }
      },
      [prompt, messages, recentRoomMessages, roomName, model, callSummarizeApi, maxHistory, saveToAIChatHistory, saveToLocal, roomState.user]
    );

  const clearHistory = useCallback(async () => {
    if (roomState.user?.id) {
      try {
        await fetch(`/api/ai-chat/history?roomId=${roomId}&userId=${roomState.user.id}`, { method: "DELETE" });
        toast.success("Chat history cleared from database!");
      } catch (err) {
        console.error("Failed to clear database history:", err);
        toast.warning("Cleared locally only");
      }
    }
    startTransition(() => {
      setMessages([]);
      localStorage.removeItem(`ai-chat-${roomId}`);
    });
  }, [roomId, roomState.user]);

  const regenerate = useCallback(() => {
    const lastUser = messages.slice().reverse().find((m) => m.role === "user");
    if (!lastUser) {
      toast.error("No user message to regenerate from");
      return;
    }
    startTransition(() => {
      setMessages((prev) => prev.slice(0, prev.indexOf(lastUser) + 1));
      setPrompt(lastUser.content);
    });
    setTimeout(handleSubmit, 0);
  }, [messages, handleSubmit]);

  const exportChat = useCallback(() => {
    const data = {
      roomId,
      roomName,
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        structuredData: m.structuredData,
        timestamp: m.timestamp.toISOString(),
        model: m.model,
        metadata: m.metadata,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Chat exported successfully!");
  }, [messages, roomName, roomId]);

  const startVoiceInput = useCallback(() => {
    if ("webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = "en-US";
      recognition.onresult = (e: any) => setPrompt((prev) => prev + e.results[0][0].transcript);
      recognition.onerror = () => toast.error("Voice input failed");
      recognition.start();
    } else {
      toast.error("Speech recognition not supported in your browser");
    }
  }, []);

  const handleAddMessage = useCallback(async () => {
    if (!prompt.trim() || !roomState.user) return;
    try {
      await supabaseBrowser()
        .from("messages")
        .insert({
          text: `AI Assistant Query: ${prompt}`,
          room_id: roomId,
          sender_id: roomState.user.id,
          is_edited: false,
          status: "sent",
        });
      toast.success("Message added to room chat!");
      setPrompt("");
    } catch (err) {
      console.error("Failed to add message:", err);
      toast.error("Failed to add message to room chat");
    }
  }, [prompt, roomState.user, roomId]);

  // ----------------- Effects -----------------
  useEffect(() => {
    loadAIChatHistory();
  }, [loadAIChatHistory]);

  useEffect(() => {
    if (!loading) saveToLocal(messages);
  }, [messages, loading, saveToLocal]);

  // Auto-scroll optimization
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userScrollingRef.current) return;
    
    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    };
    
    scrollToBottom();
  }, [messages]);

  const onUserScroll = useCallback(() => {
    userScrollingRef.current = true;
    setTimeout(() => (userScrollingRef.current = false), 800);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isExpanded]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ----------------- Memoized UI Components -----------------
  const modelOptions = useMemo(() => 
    MODELS.map(modelOption => (
      <SelectItem key={modelOption} value={modelOption} className="rounded-lg">
        {modelOption}
      </SelectItem>
    )), 
  []);

  const popoverContent = useMemo(() => (
    <PopoverContent align="end" className="w-56 p-2 rounded-xl shadow-lg">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between py-1.5 px-2 text-xs rounded-md hover:bg-accent/50 cursor-pointer">
          <span>Dark Mode</span>
          <Switch 
            checked={theme === "dark"} 
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} 
          />
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearHistory} 
          disabled={loading || !messages.length} 
          className="justify-start h-9 w-full rounded-md hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Clear History
        </Button>
        {messages.length > 1 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={regenerate} 
            disabled={loading} 
            className="justify-start h-9 w-full rounded-md hover:bg-accent/50"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Regenerate
          </Button>
        )}
        {messages.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={exportChat} 
            className="justify-start h-9 w-full rounded-md hover:bg-accent/50"
          >
            <Download className="h-3.5 w-3.5 mr-2" /> Export Chat
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={startVoiceInput} 
          disabled={loading} 
          className="justify-start h-9 w-full rounded-md hover:bg-accent/50"
        >
          <Mic className="h-3.5 w-3.5 mr-2" /> Voice Input
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddMessage}
          disabled={!prompt.trim() || !roomState.user}
          className="justify-start h-9 w-full rounded-md hover:bg-primary/10"
        >
          <Send className="h-3.5 w-3.5 mr-2" /> Add to Room
        </Button>
      </div>
    </PopoverContent>
  ), [theme, setTheme, clearHistory, loading, messages.length, regenerate, exportChat, startVoiceInput, handleAddMessage, prompt, roomState.user]);

  // ----------------- Render -----------------
  return (
    <Card className={cn(
      "flex flex-col shadow-xl border-border/20 transition-all duration-300",
      isExpanded 
        ? "fixed inset-4 z-50 bg-background/95 backdrop-blur-md" 
        : "h-full",
      className
    )}>
      <CardHeader className="flex-shrink-0 border-b bg-gradient-to-r from-background via-muted to-background/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg flex items-center justify-center"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Bot className="h-6 w-6 text-primary-foreground drop-shadow-sm" />
            </motion.div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold leading-tight">AI Assistant</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="h-9 w-9 rounded-full hover:bg-accent/80 transition-all"
                    >
                      {isExpanded ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isExpanded ? "Minimize" : "Expand"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="px-2 py-0.5">{model}</Badge>
                <span className="bg-muted/50 px-2 py-0.5 rounded-full">#{roomName}</span>
              </div>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-accent/80 transition-all">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            {popoverContent}
          </Popover>
        </div>
      </CardHeader>

      <ScrollArea ref={scrollContainerRef} onScroll={onUserScroll} className="flex-1 relative">
        <div className={cn(
          "p-4 space-y-6 mx-auto overflow-y-scroll h-[40vh]",
          isExpanded ? "h-[70vh] w-[80vw] lg:h-[70vh] lg:w-[70vw] md:h-[60vh] md:w-[70vw] " : "max-w-4xl"
        )}>
          <AnimatePresence mode="popLayout">
            {messagePairs.length > 0 ? (
              messagePairs.map((pair) => (
                <PairedMessageRenderer 
                  key={pair.user.id + (pair.assistant?.id || '')} 
                  pair={pair} 
                  theme={theme}
                  copyToClipboard={copyToClipboard}
                />
              ))
            ) : loading ? (
              Array.from({ length: 3 }, (_, i) => <MessageSkeleton key={i} />)
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <motion.div
                  className="w-20 h-20 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-10 w-10 text-primary drop-shadow" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  AI Assistant Ready
                </h3>
                <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                  Dive into #{roomName} – get structured insights, paired queries, and actionable analysis.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 p-4 bg-destructive/10 rounded-xl border border-destructive/20 flex items-center gap-3 text-sm text-destructive backdrop-blur-sm"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
              <Button variant="ghost" size="icon" onClick={() => setError(null)} className="ml-auto h-7 w-7 p-0 hover:bg-destructive/20">
                <X className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <CardContent className="p-4 border-t bg-gradient-to-r from-muted/30 to-background/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={`Ask about #${roomName}... (Ctrl+Enter to send)`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, maxPromptLength))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="min-h-[70px] pr-16 resize-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
              disabled={loading}
              maxLength={maxPromptLength}
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/80">
              {countTokens(prompt)} tokens
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={model} onValueChange={setModel} disabled={loading}>
              <SelectTrigger className="flex-1 rounded-xl">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl p-1">
                {modelOptions}
              </SelectContent>
            </Select>
            <Button 
              type="submit" 
              disabled={loading || !prompt.trim()} 
              className="flex-shrink-0 rounded-xl px-6 hover:shadow-md transition-shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
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
      </CardContent>
    </Card>
  );
}

// ------------------------- Memoized Skeleton -----------------------------
const MessageSkeleton = memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="space-y-3 p-4 animate-pulse"
  >
    {/* User skeleton */}
    <div className="bg-gradient-to-r from-blue-400/20 to-blue-500/20 rounded-xl p-3">
      <div className="flex items-start gap-2">
        <Skeleton className="h-6 w-6 rounded-full mt-0.5" />
        <div className="flex-1">
          <Skeleton className="h-4 w-48 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
    <Separator className="my-2" />
    {/* AI skeleton */}
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-start gap-2 mb-2">
        <Skeleton className="h-6 w-6 rounded-full mt-0.5 bg-primary/10" />
        <div className="flex-1">
          <Skeleton className="h-3 w-32 mb-0.5" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-20 w-full mb-2" />
      <div className="flex justify-between pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  </motion.div>
));
MessageSkeleton.displayName = 'MessageSkeleton';

// Export memoized main component
export default memo(RoomAssistantComponent);