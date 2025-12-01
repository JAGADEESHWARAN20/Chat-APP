"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useTransition,
  memo,
  KeyboardEvent,
} from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Loader2,
  Trash2,
  MoreVertical,
  Maximize2,
  Minimize2,
  Minimize,
  Maximize,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import { toast } from "@/components/ui/sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/store/user";

import { PairedMessageRenderer } from "./RoomAssistantParts/PairedMessageRenderer";
import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";
import { MODELS } from "./RoomAssistantParts/constants";

// ======================================================
// TYPES
// ======================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  structuredData?: any;
}

interface SummarizeResponse {
  success: boolean;
  fullContent: string;
  meta?: { tokens: number; model: string };
  error?: string;
}

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  isExpanded?: boolean;
  dialogMode?: boolean; // ✅ FIX: add this back
  onToggleExpand?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loadingHistory: boolean;
}

// ======================================================
// COMPONENT
// ======================================================

function RoomAssistantComponent({
  roomId,
  roomName,
  className,
  isExpanded: externalExpand,
  onToggleExpand,
  messages,
  setMessages,
  loadingHistory,
}: RoomAssistantProps) {
  
  const { theme } = useTheme();

  // Actual user from auth store
  const currentUser = useUser((s) => s.user);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(false);

  const [, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedInput, setExpandedInput] = useState(false);

  const isExpanded = externalExpand ?? expandedInput;

  // ======================================================
  // AUTOSCROLL
  // ======================================================

  useEffect(() => {
    if (!scrollRef.current || loading) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // ======================================================
  // SEND MESSAGE
  // ======================================================

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!prompt.trim()) return toast.error("Type something first");
    if (loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };

    startTransition(() => {
      setMessages((prev) => [...prev, userMsg]);
      setPrompt("");
      setLoading(true);
    });

    try {
      const res = await fetch(`/api/ai/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          roomId,
          model,
          userId: currentUser?.id ?? null,
        }),
      });

      const data: SummarizeResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "AI request failed");
      }

      const aiMsg: ChatMessage = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.fullContent,
        timestamp: new Date(),
        model,
      };

      startTransition(() => {
        setMessages((prev) => [...prev, aiMsg]);
      });
    } catch (err: any) {
      toast.error(err.message || "Request failed");

      // Remove the previously added user message
      startTransition(() => {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      });
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // ENTER TO SEND
  // ======================================================

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ======================================================
  // RENDER UI
  // ======================================================

  return (
    <div className={cn("relative w-full h-full", className)}>
      <Card
        className={cn(
          "flex flex-col h-full justify-between rounded-xl overflow-hidden backdrop-blur-xl border-border/40"
        )}
      >
        {/* HEADER */}
        <CardHeader
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/40"
          )}
        >
          <div className="w-full flex items-center justify-between gap-3">
            
            <Button variant="ghost" size="icon" onClick={onToggleExpand}>
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Title */}
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-medium text-sm">AI Assistant</span>
            </motion.div>

            {/* MENU */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-48 p-2 bg-popover border border-border/40 rounded-xl">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessages([])}
                  className="w-full justify-start text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Clear Chat
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        {/* MODEL SELECTOR */}
        <div className="px-4 py-2 border-b border-border/30 bg-card/50">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-9 text-xs rounded-xl border-border/40">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* MESSAGES */}
        <ScrollArea
          ref={scrollRef}
          className={cn(
            "flex-1 px-4 py-2 space-y-4",
            expandedInput ? "max-h-[45%]" : "max-h-[75%]"
          )}
        >
          <AnimatePresence mode="popLayout">
            {loadingHistory ? (
              <div className="flex flex-col gap-2 mt-8">
                <MessageSkeleton />
                <MessageSkeleton />
              </div>
            ) : messages.length > 0 ? (
              messages.map((msg, idx) => {
                if (msg.role !== "user") return null;

                const next = messages[idx + 1];
                const pair =
                  next && next.role === "assistant"
                    ? { user: msg, assistant: next }
                    : { user: msg };

                return (
                  <PairedMessageRenderer
                    key={msg.id}
                    pair={pair}
                    theme={theme === "dark" ? "dark" : "light"}
                  />
                );
              })
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Bot className="mx-auto mb-2 h-7 w-7 text-primary" />
                Ask something about #{roomName}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* INPUT BOX */}
        <CardContent className="border-t border-border/30 p-3 bg-card/50">
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your message..."
              className={cn(
                "rounded-xl resize-none pr-12 text-sm bg-background/60 border-border/40",
                expandedInput ? "h-[20em]" : "h-16"
              )}
            />

            {/* SEND */}
            <Button
              disabled={!prompt.trim() || loading}
              onClick={handleSubmit}
              className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>

            {/* EXPAND INPUT */}
            <button
              type="button"
              onClick={() => setExpandedInput((p) => !p)}
              className="absolute bottom-2 left-2 text-muted-foreground hover:text-foreground"
            >
              {expandedInput ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(RoomAssistantComponent);
