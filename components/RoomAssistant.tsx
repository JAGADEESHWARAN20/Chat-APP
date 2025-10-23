// Fixed and Optimized RoomAssistant.tsx
"use client";

import {
  useState,
  useRef,
  useTransition,
  useEffect,
  useCallback,
  useMemo,
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
  Star,
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

// Types
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

// Safe HTML sanitization
const sanitizeHtml = (html: string): string => {
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(html.replace(/class=/g, "className="));
  }
  // Basic sanitization as fallback
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/class=/g, "className=");
};

// Loading Skeleton Component
const MessageSkeleton = () => (
  <div className="flex space-x-3 p-4">
    <Skeleton className="h-8 w-8 rounded-full" />
    <div className="space-y-2 flex-1">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
    </div>
  </div>
);

// Enhanced ChatMessageDisplay with Safe HTML & Better UI
const ChatMessageDisplay = ({
  msg,
  copyToClipboard,
  onReact,
  theme,
}: {
  msg: ChatMessage;
  copyToClipboard: (content: string) => void;
  onReact?: (id: string, reaction: string) => void;
  theme: "light" | "dark";
}) => {
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

  const isHtmlContent = useMemo(
    () => msg.role === "assistant" && /<[^>]*div[^>]*>/i.test(msg.content),
    [msg.content, msg.role]
  );

  const shouldTruncate = msg.content.length > 500 && !isExpanded;
  const displayContent = shouldTruncate ? msg.content.slice(0, 500) + "..." : msg.content;

  const renderContent = () => {
    if (isHtmlContent) {
      const cleanHtml = sanitizeHtml(msg.content);
      return (
        <div
          className={`prose prose-sm max-w-none overflow-x-auto ${
            theme === "dark" ? "prose-invert" : ""
          }`}
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    } else {
      return (
        <div className="overflow-x-auto">
          <div className={`prose ${theme === "dark" ? "prose-invert" : ""} max-w-none`}>
            {displayContent}
          </div>
          {shouldTruncate && (
            <Button
              variant="link"
              className="p-0 h-auto text-blue-600 dark:text-blue-400 mt-2"
              onClick={() => setIsExpanded(true)}
            >
              Show more
            </Button>
          )}
        </div>
      );
    }
  };

  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
    >
      <Card
        className={`relative max-w-[85%] transition-all duration-300 ${
          msg.role === "user"
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
            : "bg-background"
        }`}
      >
        <CardContent className="p-4">
          {/* Content */}
          <div className="whitespace-pre-wrap leading-relaxed prose-sm max-w-none">
            {renderContent()}
          </div>

          {/* Footer with Actions */}
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-opacity-20">
            <span
              className={`text-xs font-medium ${
                msg.role === "user" ? "text-blue-100" : "text-muted-foreground"
              }`}
            >
              {msg.role === "user" ? "You" : `AI Assistant • ${msg.model || "Model"}`}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${
                  msg.role === "user" ? "text-blue-100" : "text-muted-foreground"
                }`}
              >
                {formattedTime}
              </span>
              {msg.role === "assistant" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(msg.content)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy message</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onReact?.(msg.id, "star")}
                        className="h-6 w-6 p-0 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add reaction</p>
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
};

// UUID generator fallback
const generateId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default function RoomAssistant({
  roomId,
  roomName,
  className = "",
  maxPromptLength = 500,
  maxHistory = 10,
  initialModel = "gpt-3.5-turbo",
}: RoomAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState(initialModel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const { messages: allMessages } = useMessage();
  const { addMessage, state: roomState } = useRoomContext();
  const { theme: systemTheme, setTheme: setSystemTheme } = useTheme();
  const theme = systemTheme === "dark" ? "dark" : "light";

  // Memoized recent room messages with proper typing
  const recentRoomMessages = useMemo(() => {
    return allMessages
      .filter((msg: Imessage) => msg.room_id === roomId)
      .slice(-20)
      .map((msg: Imessage) => {
        const sender = msg.profiles?.display_name || msg.profiles?.username || "User";
        return `${sender}: ${msg.text}`;
      })
      .join("\n");
  }, [allMessages, roomId]);

  // Load AI chat history from database
  const loadAIChatHistory = useCallback(async () => {
    if (!roomState.user?.id) return;

    try {
      // Use the API route to load AI chat history
      const response = await fetch(`/api/ai-chat/history?roomId=${roomId}&userId=${roomState.user.id}`);
      if (response.ok) {
        const history = await response.json();
        const chatMessages: ChatMessage[] = history.map((item: any) => ({
          id: item.id,
          role: "assistant" as const,
          content: item.ai_response,
          timestamp: new Date(item.created_at),
          model: item.model_used,
          isPersisted: true,
          metadata: {
            tokenCount: item.token_count,
            messageCount: item.message_count,
          },
        }));
        setMessages(chatMessages);
      }
    } catch (error) {
      console.error("Failed to load AI chat history:", error);
      // Fallback to localStorage
      loadFromLocalStorage();
    }
  }, [roomId, roomState.user]);

  // Load from localStorage as fallback
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
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
  }, [roomId, maxHistory]);

  // Save AI chat to database
  const saveToAIChatHistory = useCallback(async (
    userQuery: string,
    aiResponse: string,
    metadata: { tokenCount?: number; messageCount?: number } = {}
  ) => {
    if (!roomState.user?.id) return false;

    try {
      const response = await fetch('/api/ai-chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    } catch (error) {
      console.error('Failed to save AI chat history:', error);
      return false;
    }
  }, [roomId, roomState.user, model]);

  // Optimized local storage saving (fallback)
  const saveToLocal = useCallback((newMessages: ChatMessage[]) => {
    try {
      const key = `ai-chat-${roomId}`;
      const messagesToSave = newMessages
        .filter((m) => !m.isPersisted)
        .slice(-maxHistory)
        .map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString()
        }));
      localStorage.setItem(key, JSON.stringify(messagesToSave));
    } catch (error) {
      console.error("Failed to save to local storage:", error);
    }
  }, [roomId, maxHistory]);

  // Auto-scroll with intersection observer for better performance
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Optimized input handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value.slice(0, maxPromptLength);
      setPrompt(value);
    },
    [maxPromptLength]
  );

  // Enhanced submit handler with proper error handling and database integration
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

      setMessages((prev) => [...prev.slice(-maxHistory + 1), userMsg]);
      const userQuery = prompt;
      setPrompt("");
      setLoading(true);
      setError(null);
      setIsStreaming(true);

      // Declare responseId at the function scope so it's accessible in catch block
      let responseId = generateId();
      let fullResponse = "";

      // Build context efficiently
      const historyStr = [
        ...messages.map((m) => `${m.role}: ${m.content}`),
        `user: ${userQuery}`
      ].join("\n");
      
      const context = recentRoomMessages
        ? `Room "${roomName}" recent messages:\n${recentRoomMessages}\n\nChat History:\n${historyStr}`
        : `Room "${roomName}"\n\nChat History:\n${historyStr}`;

      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: context, 
            roomId, 
            model 
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error("No response body");
        }

        // Create AI message placeholder
        const aiMsg: ChatMessage = {
          id: responseId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          model,
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Stream processing
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case "start":
                    responseId = data.id || responseId;
                    break;
                  case "delta":
                    if (data.content) {
                      fullResponse += data.content;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === responseId ? { ...m, content: fullResponse } : m
                        )
                      );
                    }
                    break;
                  case "end":
                    // Save to AI chat history
                    const savedToDB = await saveToAIChatHistory(userQuery, fullResponse, {
                      tokenCount: Math.floor(fullResponse.length / 4), // Estimate tokens
                      messageCount: messages.length + 1,
                    });

                    if (savedToDB) {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === responseId ? { ...m, isPersisted: true } : m
                        )
                      );
                      toast.success("Response saved to chat history!");
                    } else {
                      saveToLocal([...messages, aiMsg]);
                      toast.warning("Saved locally - database sync failed.");
                    }
                    break;
                  case "error":
                    throw new Error(data.error || "Stream error");
                }
              } catch (parseError) {
                console.warn("SSE parse error:", parseError);
              }
            }
          }
        }

        toast.success("Response generated!");
      } catch (err) {
        console.error("API Error:", err);
        // Now responseId is accessible here because it's declared at function scope
        setMessages((prev) => prev.filter((m) => m.id !== responseId));
        const errorMsg = err instanceof Error ? err.message : "Request failed";
        setError(errorMsg);
        toast.error(errorMsg);
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
      roomId,
      model,
      maxHistory,
      roomState.user,
      saveToAIChatHistory,
      saveToLocal,
    ]
  );

  // Memoized utility functions
  const copyToClipboard = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => toast.success("Copied to clipboard!"))
      .catch(() => toast.error("Failed to copy"));
  }, []);

  const handleReact = useCallback((id: string, reaction: string) => {
    toast.info(`Added ${reaction} reaction`);
  }, []);

  const clearHistory = useCallback(async () => {
    if (roomState.user?.id) {
      try {
        const response = await fetch(`/api/ai-chat/history?roomId=${roomId}&userId=${roomState.user.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          toast.success("Chat history cleared from database!");
        } else {
          throw new Error('Failed to clear from database');
        }
      } catch (error) {
        console.error('Failed to clear database history:', error);
        toast.warning("Cleared locally only");
      }
    }
    
    setMessages([]);
    localStorage.removeItem(`ai-chat-${roomId}`);
  }, [roomId, roomState.user]);

  const regenerate = useCallback(() => {
    const lastUserIndex = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIndex !== -1) {
      const lastUserMessage = messages[lastUserIndex];
      setMessages((prev) => prev.slice(0, lastUserIndex + 1));
      setPrompt(lastUserMessage.content);
      setTimeout(() => handleSubmit(), 0);
    } else {
      toast.error("No user message to regenerate from");
    }
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

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
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

  // Voice input with proper error handling
  const startVoiceInput = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

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
      setPrompt(prev => prev + transcript);
    };

    recognition.onerror = (event: any) => {
      toast.error("Voice input failed: " + event.error);
    };

    recognition.start();
  }, []);

  // Effects
  useEffect(() => {
    if (roomState.user?.id) {
      loadAIChatHistory();
    }
  }, [loadAIChatHistory, roomState.user]);

  useEffect(() => {
    if (!loading) {
      saveToLocal(messages);
    }
  }, [messages, loading, saveToLocal]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <Card className={`flex flex-col h-full overflow-hidden ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Room Assistant</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {model}
                </Badge>
                <span className="text-xs text-muted-foreground">#{roomName}</span>
              </div>
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm">Dark Mode</span>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) =>
                      setSystemTheme(checked ? "dark" : "light")
                    }
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={regenerate}
                    disabled={loading}
                    className="w-full justify-start"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                )}
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exportChat}
                    className="w-full justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Chat
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startVoiceInput}
                  disabled={loading}
                  className="w-full justify-start"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Voice Input
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            <AnimatePresence mode="popLayout">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <ChatMessageDisplay
                    key={msg.id}
                    msg={msg}
                    copyToClipboard={copyToClipboard}
                    onReact={handleReact}
                    theme={theme}
                  />
                ))
              ) : loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <MessageSkeleton key={i} />
                  ))}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">Room AI Assistant</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Ask me about <strong>#{roomName}</strong>. I can analyze recent messages and provide insights.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 bg-destructive/10 border-t"
            >
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive flex-1">{error}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setError(null)}
                  className="h-6 w-6 p-0 text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 border-t">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={`Ask about #${roomName}... (Ctrl + Enter to send)`}
              value={prompt}
              onChange={handleInputChange}
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
              <span
                className={`text-xs ${
                  prompt.length > maxPromptLength * 0.9
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
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

            <Button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex-shrink-0"
            >
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
      </CardContent>
    </Card>
  );
}