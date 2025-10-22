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
  MessageSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useMessage, Imessage } from "@/lib/store/messages";
import { Badge } from "@/components/ui/badge";

// Types
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
};

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  maxPromptLength?: number;
  maxHistory?: number;
  initialModel?: string;
}

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
  const [, startTransition] = useTransition();
  const { messages: allMessages } = useMessage();

  // --- 📡 Recent room messages for context ---
  const recentRoomMessages = useMemo(() => {
    return allMessages
      .filter((msg: Imessage) => msg.room_id === roomId)
      .slice(-20)
      .map((msg: Imessage) => {
        const sender = msg.profiles?.display_name || msg.profiles?.username || "User";
        return `${sender} (${msg.created_at}): ${msg.text}`;
      })
      .join("\n");
  }, [allMessages, roomId]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value.slice(0, maxPromptLength));
    },
    [maxPromptLength]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!prompt.trim()) {
        toast.error("Enter a query about the room.");
        return;
      }

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(-maxHistory + 1), userMsg]);
      const tempPrompt = prompt;
      setPrompt("");
      setLoading(true);
      setError(null);
      setIsStreaming(true);

      startTransition(async () => {
        try {
          const historyStr = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n") + `\n${userMsg.role}: ${tempPrompt}`;
          const context = recentRoomMessages
            ? `Room "${roomName}" (${roomId}) recent:\n${recentRoomMessages}\n\nHistory:\n${historyStr}`
            : `Room "${roomName}" (${roomId}). History:\n${historyStr}`;
          const estTokens = context.length / 4 + 200;

          if (estTokens > 4000) throw new Error("Context too long—shorten query.");

          const res = await fetch("/api/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: `${context}\n\nAssistant:`, model }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "API failed");
          }

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let fullResponse = "";
          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "",
            timestamp: new Date(),
            model,
          };
          setMessages((prev) => [...prev, aiMsg]);

          while (true) {
            const { done, value } = await reader?.read() ?? { done: true };
            if (done) break;
            const chunk = decoder.decode(value);
            fullResponse += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsg.id ? { ...m, content: fullResponse } : m
              )
            );
          }

          toast.success(`Response ready (~${Math.round(estTokens)} tokens)`);
        } catch (err) {
          setMessages((prev) => prev.slice(0, -1));
          const msg = (err as Error).message;
          setError(msg.includes("429") ? "Rate limit—retry soon." : msg);
          toast.error(msg, { action: { label: "Retry", onClick: () => handleSubmit() } });
        } finally {
          setLoading(false);
          setIsStreaming(false);
        }
      });
    },
    [prompt, messages, recentRoomMessages, roomName, roomId, model, maxHistory]
  );

  const copyToClipboard = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied!");
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    toast.success("History cleared!");
  }, []);

  const regenerate = useCallback(() => {
    const lastUser = messages[messages.length - 2]?.content || "";
    if (lastUser) setPrompt(lastUser);
    handleSubmit();
  }, [messages, handleSubmit]);

  const exportChat = useCallback(() => {
    const data = messages.map((m) => ({
      role: m.role,
      content: m.content,
      time: m.timestamp.toISOString(),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported!");
  }, [messages, roomName]);

  // 🧠 Local persistence
  useEffect(() => {
    const key = `ai-chat-${roomId}`;
    const saved = localStorage.getItem(key);
    if (saved && messages.length === 0) setMessages(JSON.parse(saved));
  }, [roomId]);

  useEffect(() => {
    const key = `ai-chat-${roomId}`;
    localStorage.setItem(key, JSON.stringify(messages.slice(-maxHistory)));
  }, [messages, roomId, maxHistory]);

  return (
    <TooltipProvider>
      <motion.div
        className={`relative flex flex-col bg-gradient-to-b from-zinc-50/90 to-zinc-100/60 backdrop-blur-xl border rounded-2xl shadow-xl w-full md:w-[28rem] overflow-hidden ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* 🔝 Header */}
        <div className="flex justify-between items-center p-3 border-b bg-white/70 backdrop-blur-lg">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Bot className="h-5 w-5" />
            AI Assistant
            <Badge variant="outline" className="text-xs ml-1">{model}</Badge>
          </div>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={clearHistory} disabled={loading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear History</TooltipContent>
            </Tooltip>
            {messages.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={regenerate} disabled={loading}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={exportChat}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export Chat</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* 🧾 Messages */}
        <ScrollArea className="h-[350px] px-4 py-3 space-y-3">
          <AnimatePresence>
            {messages.length > 0 ? (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/90 border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex justify-between items-center mt-1 text-[11px] text-muted-foreground">
                      <span>{msg.role === "user" ? "You" : `AI (${msg.model})`}</span>
                      <div className="flex items-center gap-1">
                        <span>{msg.timestamp.toLocaleTimeString()}</span>
                        {msg.role === "assistant" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(msg.content)}
                            className="h-4 w-4 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Ask AI anything about <b>{roomName}</b></p>
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* ⚠️ Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 bg-red-100 text-red-800 text-sm border-t border-red-300"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError(null)}
                className="ml-auto h-5 w-5 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 📝 Input */}
        <form onSubmit={handleSubmit} className="border-t bg-white/70 backdrop-blur-lg p-3 flex flex-col gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={`Ask about "${roomName}"...`}
            value={prompt}
            onChange={handleInputChange}
            className="min-h-[60px] resize-none"
            disabled={loading}
            maxLength={maxPromptLength}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{prompt.length}/{maxPromptLength}</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="text-xs bg-muted px-2 py-1 rounded border"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 (Free)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Paid)</option>
            </select>
          </div>
          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isStreaming ? "Streaming..." : "Thinking..."}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Send
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </TooltipProvider>
  );
}
