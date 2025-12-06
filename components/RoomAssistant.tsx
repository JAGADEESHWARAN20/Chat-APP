// components/RoomAssistant.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useTransition,
  memo,
  useCallback,
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
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import { toast } from "@/components/ui/sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/store/user";

import { PairedMessageRenderer } from "./RoomAssistantParts/PairedMessageRenderer";
import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";
import { MODELS } from "./RoomAssistantParts/constants";

/* -----------------------
   Types
   ----------------------- */
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
  dialogMode?: boolean;
  onToggleExpand?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loadingHistory: boolean;
  onInputExpandChange?: (expanded: boolean) => void;
}

/* -----------------------
   Constants & Helpers
   ----------------------- */
const INPUT_HEIGHT_COMPACT = "h-[5em]";
const INPUT_HEIGHT_EXPANDED = "h-[10em]";
const SCROLLAREA_HEIGHT_COMPACT = "h-[45vh]";
const SCROLLAREA_HEIGHT_EXPANDED = "h-[60vh]"; 

/* -----------------------
   Component
   ----------------------- */
function RoomAssistantComponent({
  roomId,
  roomName,
  className,
  isExpanded: externalExpand = false,
  onToggleExpand,
  messages,
  setMessages,
  loadingHistory,
  onInputExpandChange,
}: RoomAssistantProps) {
  const { theme } = useTheme();
  const currentUser = useUser((s) => s.user);

  // Local state
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(MODELS[0] ?? "gpt-4o-mini");
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Local visual expand for textarea (affects textarea height and scrollarea height)
  const [expandedInput, setExpandedInput] = useState(false);

  // Provide parent with updates (popover adjusts translateY)
  useEffect(() => {
    onInputExpandChange?.(expandedInput);
  }, [expandedInput, onInputExpandChange]);

  const [, startTransition] = useTransition();
  const scrollRef = useRef<any>(null);

  // Auto-scroll (rAF)
  useEffect(() => {
    if (!scrollRef.current || loading) return;
    const raf = requestAnimationFrame(() => {
      try {
        const el =
          scrollRef.current?.scrollTo
            ? scrollRef.current
            : scrollRef.current?.contentElement
            ? scrollRef.current.contentElement
            : scrollRef.current?.querySelector?.(".scrollable-content") ?? scrollRef.current;
        el?.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
      } catch (e) {
        // ignore
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, loading]);

  // Handlers
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  }, []);

  const toggleExpandedInput = useCallback(() => {
    setExpandedInput((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = prompt.trim();
      if (!text) {
        toast.error("Type something first");
        return;
      }
      if (loading) return;

      const tempId = Date.now().toString();
      const userMsg: ChatMessage = {
        id: tempId,
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      startTransition(() => {
        setMessages((prev) => [...prev, userMsg]);
        setPrompt("");
        setLoading(true);
        setIsSending(true);
      });

      try {
        const res = await fetch(`/api/ai/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            roomId,
            model,
            userId: currentUser?.id ?? null,
          }),
        });
        const data: SummarizeResponse = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "AI request failed");

        const aiMsg: ChatMessage = {
          id: `${Date.now().toString()}-ai`,
          role: "assistant",
          content: data.fullContent,
          timestamp: new Date(),
          model,
        };
        startTransition(() => setMessages((prev) => [...prev, aiMsg]));
      } catch (err: any) {
        toast.error(err?.message || "Request failed");
        startTransition(() => setMessages((prev) => prev.filter((m) => m.id !== tempId)));
      } finally {
        setLoading(false);
        setIsSending(false);
      }
    },
    [prompt, model, roomId, currentUser?.id, setMessages, startTransition, loading]
  );

  // Dynamic classes based on expandedInput state
  const inputHeightClass = expandedInput ? INPUT_HEIGHT_EXPANDED : INPUT_HEIGHT_COMPACT;
  const scrollAreaHeightClass = expandedInput
    ? SCROLLAREA_HEIGHT_EXPANDED
    : SCROLLAREA_HEIGHT_COMPACT;

  const textareaClass = cn(
    "rounded-xl resize-none pr-12 text-sm bg-background/60 border-border/40",
    inputHeightClass,
    "transition-all duration-150"
  );

  // Render
  return (
    <div className={cn("relative w-full h-[80vh]", className)}>
      <Card
        className={cn(
          "flex flex-col min-h-0 h-full justify-between rounded-xl overflow-hidden backdrop-blur-xl border-border/40 relative z-40"
        )}
      >
        {/* Header */}
        <CardHeader className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/40">
          <div className="w-full flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              aria-label="Expand/Minimize"
            >
              {externalExpand ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Assistant menu">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-48 p-2 bg-popover border border-border/40 rounded-xl z-[9999]">
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

        {/* Model selector */}
        <div className="px-4 py-2 border-b border-border/30 bg-card/50">
          <Select
            value={model}
            onValueChange={useCallback((v: string) => setModel(v), [])}
          >
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

        {/* Messages area with dynamic height */}
        <div className="flex-1">
          <ScrollArea
            ref={scrollRef}
            className={cn(
              "px-4 py-2 space-y-4 overflow-hidden min-h-0",
              scrollAreaHeightClass
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
        </div>

        {/* Input footer (fixed) */}
        <CardContent className="border-t absolute bottom-0 w-[100%] border-border/30 p-3 bg-card/50">
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              placeholder="Write your message..."
              aria-label="Assistant message input"
              className={textareaClass}
              rows={1}
            />

            <Button
              disabled={!prompt.trim() || isSending}
              onClick={handleSubmit}
              className="absolute bottom-3 right-3 h-8 w-8 p-0 rounded-full"
              aria-label="Send"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>

            <button
              type="button"
              onClick={toggleExpandedInput}
              className="absolute bottom-3 left-3 text-muted-foreground hover:text-foreground"
              aria-label="Toggle input size"
            >
              {expandedInput ? (
                <Minimize2 className="h-4 w-4" />
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