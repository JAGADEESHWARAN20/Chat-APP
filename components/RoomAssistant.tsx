"use client";

import { useState, useRef, useTransition, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useMessage, Imessage } from "@/lib/store/messages";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, X, Bot, MessageSquare, Copy, AlertCircle, RefreshCw, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion"; // npm i framer-motion

// Inline debounce
function useDebounceCallback<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
}

// Chat msg type
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; timestamp: Date; model?: string };

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
  const [response, setResponse] = useState(""); // Fixed: Full state + setter
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, startTransition] = useTransition();
  const { messages: allMessages } = useMessage();

  // Memoized room context
  const recentRoomMessages = useMemo(() => {
    return allMessages
      .filter((msg: Imessage) => msg.room_id === roomId)
      .slice(-20)
      .map((msg: Imessage) => {
        const sender = msg.profiles?.display_name || msg.profiles?.username || "User";
        return `${sender} (${msg.created_at}): ${msg.text}`;
      })
      .join('\n');
  }, [allMessages, roomId]);

  // Debounce
  const debouncedSetPrompt = useDebounceCallback(setPrompt, 300);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    debouncedSetPrompt(e.target.value.slice(0, maxPromptLength));
  }, [debouncedSetPrompt, maxPromptLength]);

  // Submit
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Enter a query about the room.");
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: prompt, timestamp: new Date() };
    setMessages((prev) => [...prev.slice(-maxHistory + 1), userMsg]);
    const tempPrompt = prompt;
    setPrompt("");
    setLoading(true);
    setError(null);
    setIsStreaming(true);

    startTransition(async () => {
      try {
        const historyStr = messages.map((m) => `${m.role}: ${m.content}`).join('\n') + `\n${userMsg.role}: ${tempPrompt}`;
        const context = recentRoomMessages ? `Room "${roomName}" (${roomId}) recent:\n${recentRoomMessages}\n\nHistory:\n${historyStr}` : `Room "${roomName}" (${roomId}). History:\n${historyStr}`;
        const estTokens = context.length / 4 + 200;

        if (estTokens > 4000) {
          throw new Error("Context too long—clear history or shorten query.");
        }

        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `${context}\n\nAssistant:`, model }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "API failed");
        }

        // Streaming
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: "", timestamp: new Date(), model };
        setMessages((prev) => [...prev, aiMsg]);

        while (true) {
          const { done, value } = await reader?.read() ?? { done: true, value: undefined };
          if (done) break;
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          setResponse(fullResponse); // Fixed: Now callable
          setMessages((prev) => prev.map((m) => m.id === aiMsg.id ? { ...m, content: fullResponse } : m));
        }

        toast.success("Ready! (~" + Math.round(estTokens) + " tokens)");
      } catch (err) {
        setMessages((prev) => prev.slice(0, -1));
        const msg = (err as Error).message;
        setError(msg.includes("429") ? "Rate limit—retry soon." : msg);
        toast.error(msg, { 
          action: { label: "Retry", onClick: () => handleSubmit() } // Fixed: No fake e/as any
        });
      } finally {
        setLoading(false);
        setIsStreaming(false);
      }
    });
  }, [prompt, messages, recentRoomMessages, roomName, roomId, model, maxHistory]);

  const copyToClipboard = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied!");
  }, []);

  const clearAll = useCallback(() => {
    setPrompt("");
    setMessages([]);
    setError(null);
    textareaRef.current?.focus();
    toast("Cleared!");
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

  // Export
  const exportChat = useCallback(() => {
    const data = messages.map((m) => ({
      role: m.role,
      content: m.content,
      time: m.timestamp.toISOString(),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported!");
  }, [messages, roomName]);

  // Persist
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
      <Card className={`w-full md:w-80 lg:w-96 h-fit ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Assistant
              <Badge variant="outline" className="text-xs">
                {model} | {messages.length} msgs
              </Badge>
            </div>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={clearHistory} disabled={loading} title="Clear history">
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear history</TooltipContent>
              </Tooltip>
              {messages.length > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={regenerate} disabled={loading} title="Regenerate">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate last</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={exportChat} title="Export chat">
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export chat</TooltipContent>
              </Tooltip>
            </div>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <Tooltip>
              <TooltipTrigger>Context: {recentRoomMessages ? `${recentRoomMessages.split('\n').length} recent msgs` : "No msgs yet"}</TooltipTrigger>
              <TooltipContent>AI uses room history + your chat</TooltipContent>
            </Tooltip>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              ref={textareaRef}
              placeholder={`Query "${roomName}"... (e.g., "Summarize trends?")`}
              value={prompt}
              onChange={handleInputChange}
              className="min-h-[60px] max-h-[120px]"
              maxLength={maxPromptLength}
              disabled={loading}
              aria-label="AI input"
              aria-describedby={error ? "error-msg" : undefined}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{prompt.length}/{maxPromptLength}</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={loading} className="text-xs bg-muted px-2 py-1 rounded border">
                <option value="gpt-3.5-turbo">3.5 Turbo (Free)</option>
                <option value="gpt-4o-mini">4o Mini (Paid)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading || !prompt.trim()}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isStreaming ? "Streaming..." : "Thinking..."}</> : <><Send className="mr-2 h-4 w-4" />Send</>}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={loading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Error (Animated) */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive-foreground text-sm"
                id="error-msg"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="h-4 w-4" />
                {error}
                <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto h-6 w-6 p-0">
                  <X className="h-3 w-3" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History (Animated Bubbles) */}
          {messages.length > 0 ? (
            <ScrollArea className="h-[250px] md:h-[300px] space-y-3">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <motion.div
                      layout
                      className={`max-w-[80%] p-3 rounded-2xl ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                      animate={{ scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>{msg.role === "user" ? "You" : `AI (${msg.model})`}</span>
                        <span>{msg.timestamp.toLocaleTimeString()}</span>
                        {msg.role === "assistant" && (
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(msg.content)} className="h-4 w-4 p-0 ml-1">
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </ScrollArea>
          ) : !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Start chatting about {roomName}...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}