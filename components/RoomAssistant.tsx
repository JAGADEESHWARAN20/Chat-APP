"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Loader2,
  Mic,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  MoreVertical,
  X,
  AlertCircle,
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
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useMessage } from "@/lib/store/messages";
import { useRoomContext } from "@/lib/store/RoomContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { estimateTokens } from "@/lib/token-utils";
import { cn } from "@/lib/utils";
import { PairedMessageRenderer } from "./RoomAssistantParts/PairedMessageRenderer";
import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";
import { MODELS } from "./RoomAssistantParts/constants";

function RoomAssistantComponent({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const { theme, setTheme } = useTheme();
  const { messages: allMessages } = useMessage();
  const { user } = useRoomContext(); // ✅ user from context

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && !loading)
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim()) return toast.error("Type something first");

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
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          roomId,
          userId: user?.id || "system",
          model,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API failed");

      const aiMsg = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.fullContent,
        timestamp: new Date(),
        model,
      };

      startTransition(() => setMessages((prev) => [...prev, aiMsg]));
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
      <Card
        className={cn(
          "flex flex-col rounded-2xl overflow-hidden shadow-xl border-border/20",
          "bg-[hsl(var(--background))]/80 backdrop-blur-md transition-all duration-300"
        )}
      >
        {/* Header */}
        <CardHeader className="flex items-center justify-between px-5 py-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <motion.div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow">
              <Bot className="h-5 w-5 text-white" />
            </motion.div>
            <CardTitle className="text-lg font-bold">AI Assistant</CardTitle>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3">
              <div className="space-y-2 text-sm">
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
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>

        {/* Chat Area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4 space-y-5 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {messages.length > 0 ? (
              messages.map((msg, i) => {
                if (msg.role === "assistant") return null;
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
              Array.from({ length: 3 }, (_, i) => <MessageSkeleton key={i} />)
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <Bot className="h-10 w-10 text-primary mb-2" />
                <p className="text-muted-foreground text-sm">
                  Ask something about #{roomName}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Input */}
        <CardContent className="border-t p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              placeholder={`Ask about #${roomName}...`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[70px] pr-16 resize-none rounded-xl focus-visible:ring-primary/50"
            />
            <div className="flex gap-2">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="flex-1 rounded-xl">
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
                className="px-5 rounded-xl hover:shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" /> Send
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
