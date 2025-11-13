"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useTransition,
  memo,
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
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useRoomContext } from "@/lib/store/RoomContext";
import { cn } from "@/lib/utils";
import { PairedMessageRenderer } from "./RoomAssistantParts/PairedMessageRenderer";
import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";
import { MODELS } from "./RoomAssistantParts/constants";

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  dialogMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onCloseDialog?: () => void;
}

function RoomAssistantComponent({
  roomId,
  roomName,
  className,
  dialogMode = false,
  isExpanded: externalExpand,
  onToggleExpand,
  onCloseDialog,
}: RoomAssistantProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useRoomContext();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localExpand, setLocalExpand] = useState(false);
  const isExpanded = externalExpand ?? localExpand;

  // 🔹 Fetch chat history
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      if (!roomId) return;
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/ai-chat/history?roomId=${roomId}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.warn("[AI History] failed:", err);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [roomId, dialogMode]);

  // 🔹 Auto-scroll on new messages
  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && !loading) {
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  // 🔹 Reset on close
  useEffect(() => {
    if (!dialogMode) return;
    if (!isExpanded && messages.length > 0) {
      setMessages([]);
      setError(null);
      setPrompt("");
      setLoading(false);
    }
  }, [isExpanded, dialogMode]);

  // 🧠 Send message
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim()) return toast.error("Type something first");
    if (loading) return;

    const userMsg = {
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
      const res = await fetch(`/api/${user?.id || "system"}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, roomId, model }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");

      const aiMsg = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.fullContent,
        timestamp: new Date(),
        model,
      };

      startTransition(() =>
        setMessages((prev) => {
          if (prev.some((m) => m.content === aiMsg.content && m.role === "assistant")) {
            return prev;
          }
          return [...prev, aiMsg];
        })
      );
    } catch (err: any) {
      console.error("[AI Assistant Error]", err);
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Failed to fetch AI response");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = () => {
    if (onToggleExpand) onToggleExpand();
    else setLocalExpand((prev) => !prev);
  };

  // 🧱 Loading state
  if (historyLoading) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-6",
          "bg-[hsl(var(--background))]/85 backdrop-blur-xl rounded-2xl border border-border/20",
          "transition-all duration-300 ease-in-out shadow-sm",
          className
        )}
      >
        <div className="flex flex-col gap-2 w-full max-w-md px-6">
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading chat history...
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-full", className)}>
      <Card
        className={cn(
          "flex flex-col rounded-2xl h-full overflow-hidden border border-border/20 shadow-md",
          "bg-[hsl(var(--background))]/80 backdrop-blur-xl transition-all duration-300"
        )}
      >
        {/* Header */}
        <CardHeader
          className={cn(
            "flex items-center justify-between border-b border-border/30",
            dialogMode ? "px-3 py-2" : "px-5 py-3"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpand}
              title={isExpanded ? "Minimize" : "Expand"}
              className="rounded-full"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            <div className="flex items-center gap-2">
              <motion.div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </motion.div>
              <CardTitle
                className={cn(
                  "font-semibold tracking-tight",
                  dialogMode ? "text-sm" : "text-base"
                )}
              >
                AI Assistant
              </CardTitle>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span>Dark Mode</span>
                    <Switch
                      checked={theme === "dark"}
                      onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                    />
                  </div>
                  <Separator className="my-2" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMessages([])}
                    className="w-full justify-start text-red-500"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear Chat
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        {/* Chat */}
        <ScrollArea
          ref={scrollRef}
          className={cn(
            "flex-1 ",
            dialogMode ? "p-3 space-y-3" : "p-4 space-y-5"
          )}
        >
          <AnimatePresence mode="popLayout">
            {messages.length > 0 ? (
              messages.map((msg, i) => {
                if (msg.role !== "user") return null;
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
            ) : loading ? (
              Array.from({ length: 2 }, (_, i) => <MessageSkeleton key={i} />)
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "flex flex-col items-center justify-center text-center text-muted-foreground",
                  dialogMode ? "py-8 text-xs" : "py-16 text-sm"
                )}
              >
                <Bot className={cn(dialogMode ? "h-6 w-6 mb-1" : "h-8 w-8 mb-2", "text-primary")} />
                <p>Ask something about #{roomName}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Input */}
        <CardContent className={cn("border-t", dialogMode ? "p-3" : "p-4")}>
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              placeholder={`Ask about #${roomName}...`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className={cn(
                "min-h-[60px] resize-none rounded-xl focus-visible:ring-primary/50",
                dialogMode ? "text-xs p-2" : "text-sm p-3"
              )}
            />
            <div className="flex gap-2">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger
                  className={cn("flex-1 rounded-xl", dialogMode ? "text-xs h-8 px-2" : "text-sm h-9 px-3")}
                >
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
              <Button
                type="submit"
                disabled={loading || !prompt.trim()}
                className={cn(
                  "rounded-xl flex items-center",
                  dialogMode ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Analyzing
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-2" /> Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(RoomAssistantComponent);
