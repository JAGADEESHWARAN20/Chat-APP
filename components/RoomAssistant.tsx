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
  Minimize,
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

/* ---------------- TYPES ---------------- */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  structuredData?: any;
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

/* ---------------- CONSTANTS ---------------- */

const INPUT_MIN_HEIGHT = "min-h-[4.5rem]";
const INPUT_MAX_HEIGHT = "min-h-[9rem]";

/* ---------------- COMPONENT ---------------- */

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

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(MODELS[0] ?? "gpt-4o-mini");
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [expandedInput, setExpandedInput] = useState(false);
  const scrollRef = useRef<any>(null);

  const [, startTransition] = useTransition();

  /* inform parent popover when input expands */
  useEffect(() => {
    onInputExpandChange?.(expandedInput);
  }, [expandedInput, onInputExpandChange]);

  /* Auto-scroll on new messages */
  useEffect(() => {
    if (!scrollRef.current || loading) return;
    const raf = requestAnimationFrame(() => {
      try {
        const el =
          scrollRef.current?.contentElement ??
          scrollRef.current ??
          scrollRef.current?.querySelector?.(".scrollable-content");

        el?.scrollTo?.({
          top: el.scrollHeight,
          behavior: "smooth",
        });
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, loading]);

  /* input handlers */
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
    [prompt]
  );

  /* submit */
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
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "AI request failed");

        const aiMsg: ChatMessage = {
          id: `${Date.now()}-ai`,
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

  /* textarea classes */
  const textareaClass = cn(
    "rounded-xl resize-none pr-12 text-sm bg-background/60 border border-border/40 w-full transition-all duration-150",
    expandedInput ? INPUT_MAX_HEIGHT : INPUT_MIN_HEIGHT
  );

  return (
    <div className={cn("relative w-full h-full flex flex-col", className)}>
      <Card className="flex flex-col flex-1 rounded-xl overflow-hidden border-border/40 bg-background/40 backdrop-blur-xl">
        
        {/* HEADER */}
        <CardHeader className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/40 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="icon" onClick={onToggleExpand}>
              {externalExpand ? <Minimize2 /> : <Maximize2 />}
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
                <Button variant="ghost" size="icon">
                  <MoreVertical />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 bg-popover border border-border/40 rounded-xl">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessages([])}
                  className="w-full justify-start text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        {/* MODEL SELECT */}
        <div className="px-4 py-2 border-b border-border/30 bg-card/50 flex-shrink-0">
          <Select value={model} onValueChange={(v) => setModel(v)}>
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

        {/* MESSAGES AREA (flex-grow) */}
        <ScrollArea
          ref={scrollRef}
          className="flex-1 min-h-0 px-4 py-2 "
        >
          <AnimatePresence mode="popLayout">
            {loadingHistory ? (
              <div className="flex flex-col gap-2 mt-8">
                <MessageSkeleton />
                <MessageSkeleton />
              </div>
            ) : messages.length > 0 ? (
              messages.map((msg, i) => {
                const next = messages[i + 1];
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

        {/* INPUT AREA (flex-shrink-0) */}
        <CardContent className="border-t border-border/30 bg-card/50 p-3 flex-shrink-0">
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              placeholder="Write your message..."
              className={textareaClass}
            />

            <Button
              disabled={!prompt.trim() || isSending}
              onClick={handleSubmit}
              className="absolute bottom-3 right-3 h-8 w-8 p-0 rounded-full"
            >
              {isSending ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>

            <button
              onClick={toggleExpandedInput}
              className="absolute bottom-3 left-3 text-muted-foreground hover:text-foreground"
            >
              {expandedInput ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(RoomAssistantComponent);
