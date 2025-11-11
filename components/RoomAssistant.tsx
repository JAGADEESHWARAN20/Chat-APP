"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useTransition,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Loader2, Mic, RefreshCw, Download, Trash2, Maximize2, Minimize2, MoreVertical, X, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// ✅ Responsive, Glassy, and Adaptive AI Assistant
function RoomAssistantComponent({
  roomId,
  roomName,
  dialogMode = false,
  isExpanded: externalExpanded,
  onToggleExpand,
  onCloseDialog,
  className, // ✅ add this line
}: {
  roomId: string;
  roomName: string;
  className?: string; // ✅ add this line
  dialogMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onCloseDialog?: () => void;
}) {

  const { theme, setTheme } = useTheme();
  const { messages: allMessages } = useMessage();
  const roomCtx = useRoomContext();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isExpanded = dialogMode ? externalExpanded : expanded;

  const toggleExpand = useCallback(() => {
    if (dialogMode && onToggleExpand) onToggleExpand();
    else setExpanded((p) => !p);
  }, [dialogMode, onToggleExpand]);

  // 📜 Scroll always to bottom
  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && !loading) scroll.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // 🧠 Handle submit
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
      const context = allMessages
        .filter((m) => m.room_id === roomId)
        .slice(-20)
        .map((m) => `${m.profiles?.username}: ${m.text}`)
        .join("\n");

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, roomId, context, model }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      const aiMsg = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.fullContent || "No response",
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

  // 🎙️ Voice input
  const startVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window)) return toast.error("Not supported");
    const rec = new (window as any).webkitSpeechRecognition();
    rec.lang = "en-US";
    rec.onresult = (e: any) => setPrompt((p) => p + e.results[0][0].transcript);
    rec.onerror = () => toast.error("Voice input failed");
    rec.start();
  };

  const handleAddMessage = async () => {
    if (!prompt.trim()) return;
    try {
      await getSupabaseBrowserClient()
        .from("messages")
        .insert({ room_id: roomId, text: `AI Query: ${prompt}`, sender_id: roomCtx.user?.id });
      toast.success("Added to room chat");
      setPrompt("");
    } catch {
      toast.error("Failed to add message");
    }
  };

  const clearHistory = () => {
    setMessages([]);
    toast.info("History cleared");
  };

  const exportChat = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ======================== UI ========================
  return (
    <div className="relative w-full">
      <Card
        className={cn(
          "flex flex-col rounded-2xl overflow-hidden shadow-xl border-border/20",
          "bg-[hsl(var(--background))]/80 backdrop-blur-md transition-all duration-300",
          isExpanded
            ? "fixed inset-0 m-auto max-w-[95vw] max-h-[90vh] z-50"
            : "w-full sm:w-[85vw] lg:w-[60vw] h-[65vh]",
        )}
      >
        {/* HEADER */}
        <CardHeader className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-gradient-to-r from-muted/40 to-background/30 backdrop-blur">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow"
            >
              <Bot className="h-5 w-5 text-white" />
            </motion.div>
            <CardTitle className="text-lg font-bold">AI Assistant</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleExpand}>
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 rounded-xl p-3 backdrop-blur-xl border border-border/30 bg-background/90">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Dark Mode</span>
                    <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
                  </div>
                  <Separator className="my-2" />
                  <Button variant="ghost" size="sm" onClick={clearHistory} className="w-full justify-start text-red-500">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear History
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportChat} className="w-full justify-start">
                    <Download className="mr-2 h-3.5 w-3.5" /> Export Chat
                  </Button>
                  <Button variant="ghost" size="sm" onClick={startVoiceInput} className="w-full justify-start">
                    <Mic className="mr-2 h-3.5 w-3.5" /> Voice Input
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleAddMessage} className="w-full justify-start text-blue-500">
                    <Send className="mr-2 h-3.5 w-3.5" /> Add to Room
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        {/* CHAT AREA */}
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0 p-4 space-y-5 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="popLayout">
  {messages.length > 0 ? (
    // ✅ create pairs dynamically
    messages.map((msg, i) => {
      if (msg.role === "assistant") return null; // skip isolated assistants

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


          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError(null)}
                className="ml-auto h-7 w-7 hover:bg-red-500/20"
              >
                <X className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </ScrollArea>

        {/* INPUT AREA */}
        <CardContent className="border-t border-border/30 p-4 backdrop-blur-md bg-background/70">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder={`Ask about #${roomName}...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[70px] pr-16 resize-none rounded-xl focus-visible:ring-primary/50"
              />
              <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                {estimateTokens(prompt)} tokens
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="flex-1 rounded-xl">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
