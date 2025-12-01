// components/RoomAssistant.tsx
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

import { toast } from "@/components/ui/sonner"

import { useTheme } from "next-themes";
// import { useRoomContext } from "@/lib/store/RoomContext";
import { cn } from "@/lib/utils";

import { PairedMessageRenderer } from "./RoomAssistantParts/PairedMessageRenderer";
import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";
import { MODELS } from "./RoomAssistantParts/constants";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  dialogMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loadingHistory: boolean;
}


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
  meta?: {
    tokens: number;
    model: string;
  };
  error?: string;
}

interface HistoryResponse {
  success: boolean;
  messages: ChatMessage[];
  error?: string;
}

function RoomAssistantComponent(props: RoomAssistantProps) {
  const {
    roomId,
    roomName,
    className,

    isExpanded: externalExpand,
    onToggleExpand,
    messages,
    setMessages,
    loadingHistory,
  } = props;

  const { theme, setTheme } = useTheme();
  const { user } = useUnifiedRoomStore();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");

  const [loading, setLoading] = useState(false);


  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [expandedInput, setExpandedInput] = useState(false);

  const isExpanded = externalExpand ?? expandedInput;



  /* ------------------ Auto Scroll ------------------ */
  useEffect(() => {
    if (!scrollRef.current || loading) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  /* ------------------ Send Message ------------------ */
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
      setMessages((p) => [...p, userMsg]);
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
          userId: user?.id
        }),
      });

      const data: SummarizeResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI request failed");
      }

      if (!data.success) {
        throw new Error(data.error || "AI request failed");
      }

      const aiMsg: ChatMessage = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.fullContent,
        timestamp: new Date(),
        model,
      };

      startTransition(() => setMessages((prev) => [...prev, aiMsg]));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);

      // Remove the user message if AI failed
      startTransition(() => setMessages((prev) => prev.filter(m => m.id !== userMsg.id)));
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ Enter Submit ------------------ */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };



  return (
    <div className={cn("relative w-full h-full ", className)}>
      <Card
        className={cn(
          "flex flex-col h-full justify-between   rounded-lg overflow-hidden  transition",
          "backdrop-blur-xl ",
          ""
        )}
      >
        {/* HEADER */}
        <CardHeader
          className={cn(
            "flex items-center justify-between border-b",
            "border-border/40 bg-[hsl(var(--card))]/40 dark:bg-[hsl(var(--card))]/30",
            "px-4 py-3 transition-colors"
          )}
        >
          <div className="w-full flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="rounded-full"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4 text-foreground/80" />
              ) : (
                <Maximize2 className="h-4 w-4 text-foreground/80" />
              )}
            </Button>

            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
            >
              <motion.div
                layout
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  "bg-primary text-primary-foreground shadow-sm"
                )}
              >
                <Bot className="h-4 w-4" />
              </motion.div>
              <motion.span
                layout
                className="font-medium text-sm"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 240, damping: 20 }}
              >
                AI Assistant
              </motion.span>
            </motion.div>

            {/* RIGHT MENU */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="h-4 w-4 text-foreground/70" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                side="left"
                className={cn(
                  "w-52 mt-[6em] shadow-md rounded-xl",
                  "bg-[hsl(var(--popover))] border border-border/30"
                )}
              >
                <div className="space-y-2 text-xs">




                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMessages([])}
                    className="w-full justify-start text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Clear Chat
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        {/* Rest of your component remains the same... */}
        {/* MODEL SELECTOR */}
        <div className="px-4 py-2 border-b border-border/30 bg-background/40 dark:bg-background/20">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger
              className="h-9 text-xs rounded-xl bg-background/50 dark:bg-background/30 border-border/40"
            >
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/30">
              {MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* MESSAGES SCROLL AREA */}
        <ScrollArea
          ref={scrollRef}
          className={cn(
            "flex-1 px-4 transition-all space-y-4",
            expandedInput ? "max-h-[45%]" : "max-h-[75%]"
          )}
        >
          <AnimatePresence mode="popLayout">
            {loadingHistory ? (
              <div className="w-full h-full flex flex-col gap-2 justify-center px-6">
                <MessageSkeleton />
                <MessageSkeleton />
              </div>
            ) : messages.length > 0 ? (
              messages.map((msg, i) => {
                if (msg.role !== "user") return null;
                const next = messages[i + 1];
                const pair = next?.role === "assistant"
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

        {/* INPUT */}
        <CardContent className="border-t border-border/30 p-3 bg-background/50 dark:bg-background/30">
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your message..."
              className={cn(
                "rounded-xl resize-none pr-12 text-sm",
                "bg-background/60 dark:bg-background/40 border-border/40",
                expandedInput ? "h-[20em] " : "h-16"
              )}
            />

            {/* SEND */}
            <Button
              type="button"
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

            {/* EXPAND TEXTAREA */}
            <button
              type="button"
              onClick={() => setExpandedInput((p) => !p)}
              className="absolute bottom-2 left-2 text-muted-foreground hover:text-foreground"
            >
              {expandedInput ? (
                <Minimize className="h-4 w-4 " />
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

// "use client";

// import React, {
//   useState,
//   useEffect,
//   useRef,
//   useTransition,
//   memo,
//   KeyboardEvent,
// } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Bot,
//   Send,
//   Loader2,
//   Trash2,
//   MoreVertical,
//   Maximize2,
//   Minimize2,
// } from "lucide-react";

// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";

// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";

// import {
//   Card,
//   CardHeader,
//   CardContent,
// } from "@/components/ui/card";

// import {
//   Popover,
//   PopoverTrigger,
//   PopoverContent,
// } from "@/components/ui/popover";

// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Switch } from "@/components/ui/switch";
// import { Separator } from "@/components/ui/separator";
// import { toast } from "/components/ui/sonner"

// import { useTheme } from "next-themes";
// import { useRoomContext } from "@/lib/store/RoomContext";
// import { cn } from "@/lib/utils";

// import { PairedMessageRenderer } from "./RoomAssistantParts/PairedMessageRenderer";
// import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";
// import { MODELS } from "./RoomAssistantParts/constants";


// function RoomAssistantComponent({
//   roomId,
//   roomName,
//   className,
//   dialogMode = false,
//   isExpanded: externalExpand,
//   onToggleExpand,
// }: any) {
//   const { theme, setTheme } = useTheme();
//   const { user } = useRoomContext();

//   const [prompt, setPrompt] = useState("");
//   const [model, setModel] = useState("gpt-4o-mini");
//   const [messages, setMessages] = useState<any[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [historyLoading, setHistoryLoading] = useState(true);

//   const [, startTransition] = useTransition();
//   const scrollRef = useRef<HTMLDivElement>(null);

//   const [expandedInput, setExpandedInput] = useState(false);

//   const isExpanded = externalExpand ?? expandedInput;

//   /* ------------------ Fetch History ------------------ */
//   useEffect(() => {
//     let mount = true;
//     (async () => {
//       if (!roomId) return;
//       setHistoryLoading(true);

//       try {
//         const res = await fetch(`/api/ai-chat/history?roomId=${roomId}`);
//         const data = await res.json();
//         if (mount && data.success) setMessages(data.messages);
//       } catch (_) {}
//       finally { mount && setHistoryLoading(false); }
//     })();

//     return () => { mount = false; };
//   }, [roomId]);

//   /* ------------------ Auto Scroll ------------------ */
//   useEffect(() => {
//     if (!scrollRef.current || loading) return;
//     scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
//   }, [messages, loading]);

//   /* ------------------ Send Message ------------------ */
//   const handleSubmit = async (e?: any) => {
//     e?.preventDefault();
//     if (!prompt.trim()) return toast.error("Type something first");
//     if (loading) return;

//     const userMsg = {
//       id: Date.now().toString(),
//       role: "user",
//       content: prompt,
//       timestamp: new Date(),
//     };

//     startTransition(() => {
//       setMessages((p) => [...p, userMsg]);
//       setPrompt("");
//       setLoading(true);
//     });

//     try {
//       const res = await fetch(`/api/${user?.id || "system"}/summarize`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ prompt, roomId, model }),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "AI request failed");

//       const aiMsg = {
//         id: Date.now().toString() + "-ai",
//         role: "assistant",
//         content: data.fullContent,
//         timestamp: new Date(),
//         model,
//       };

//       startTransition(() => setMessages((prev) => [...prev, aiMsg]));
//     } catch (err: any) {
//       toast.error(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ------------------ Enter Submit ------------------ */
//   const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSubmit();
//     }
//   };

//   /* ------------------ Loading UI ------------------ */
//   if (historyLoading) {
//     return (
//       <div className="w-full h-full flex flex-col gap-2 justify-center px-6">
//         <MessageSkeleton />
//         <MessageSkeleton />
//         <MessageSkeleton />
//       </div>
//     );
//   }

//   /* -------------------------------------------------- */
//   /* ---------------------- UI ------------------------ */
//   /* -------------------------------------------------- */

//   return (
//     <div className={cn("relative w-full h-full", className)}>
//       <Card
//         className={cn(
//           "flex flex-col h-full rounded-2xl overflow-hidden shadow-lg transition",
//           "backdrop-blur-xl border border-border/30",
//           "bg-[hsl(var(--card))]/70 dark:bg-[hsl(var(--card))]/50"
//         )}
//       >

//         {/* HEADER */}
//         <CardHeader
//           className={cn(
//             "flex items-center justify-between border-b",
//             "border-border/40 bg-[hsl(var(--card))]/40 dark:bg-[hsl(var(--card))]/30",
//             "px-4 py-3 transition-colors"
//           )}
//         >
//           {/* LEFT */}
//           <div className="w-full flex items-center justify-between gap-3">
//             <Button variant="ghost" size="icon" onClick={onToggleExpand} className="rounded-full">
//               {isExpanded ? (
//                 <Minimize2 className="h-4 w-4 text-foreground/80" />
//               ) : (
//                 <Maximize2 className="h-4 w-4 text-foreground/80" />
//               )}
//             </Button>
//             <motion.div
//   className="flex items-center gap-2"
//   initial={{ opacity: 0, y: -8 }}
//   animate={{ opacity: 1, y: 0 }}
//   transition={{ type: "spring", stiffness: 220, damping: 18 }}
// >
//   {/* Icon container */}
//   <motion.div
//     layout
//     whileHover={{ scale: 1.08 }}
//     whileTap={{ scale: 0.95 }}
//     transition={{ type: "spring", stiffness: 260, damping: 18 }}
//     className={cn(
//       "w-8 h-8 rounded-lg flex items-center justify-center",
//       "bg-primary text-primary-foreground shadow-sm"
//     )}
//   >
//     <Bot className="h-4 w-4" />
//   </motion.div>

//   {/* Text */}
//   <motion.span
//     layout
//     className="font-medium text-sm"
//     initial={{ opacity: 0, x: -6 }}
//     animate={{ opacity: 1, x: 0 }}
//     transition={{ delay: 0.05, type: "spring", stiffness: 240, damping: 20 }}
//   >
//     AI Assistant
//   </motion.span>
// </motion.div>


//           {/* RIGHT MENU */}
//           <Popover>
//             <PopoverTrigger asChild>
//               <Button variant="ghost" size="icon" className="rounded-full">
//                 <MoreVertical className="h-4 w-4 text-foreground/70" />
//               </Button>
//             </PopoverTrigger>

//             <PopoverContent
//               className={cn(
//                 "w-52 p-3 shadow-md rounded-xl",
//                 "bg-[hsl(var(--popover))] border border-border/30"
//               )}
//             >
//               <div className="space-y-2 text-xs">
//                 <div className="flex justify-between items-center">
//                   <span>Dark Mode</span>
//                   <Switch
//                     checked={theme === "dark"}
//                     onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
//                     />
//                 </div>

//                 <Separator className="my-2" />

//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={() => setMessages([])}
//                   className="w-full justify-start text-red-500 hover:bg-red-500/10"
//                   >
//                   <Trash2 className="mr-2 h-3.5 w-3.5" />
//                   Clear Chat
//                 </Button>
//               </div>
//             </PopoverContent>
//           </Popover>
//                   </div>
//         </CardHeader>

//         {/* MODEL SELECTOR */}
//         <div className="px-4 py-2 border-b border-border/30 bg-background/40 dark:bg-background/20">
//           <Select value={model} onValueChange={setModel}>
//             <SelectTrigger
//               className="h-9 text-xs rounded-xl bg-background/50 dark:bg-background/30 border-border/40"
//             >
//               <SelectValue placeholder="Model" />
//             </SelectTrigger>
//             <SelectContent className="bg-popover border-border/30">
//               {MODELS.map((m) => (
//                 <SelectItem key={m} value={m}>
//                   {m}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>

//         {/* MESSAGES SCROLL AREA */}
//         <ScrollArea
//           ref={scrollRef}
//           className={cn(
//             "flex-1 px-4 transition-all space-y-4",
//             expandedInput ? "max-h-[45%]" : "max-h-[75%]"
//           )}
//         >
//           <AnimatePresence mode="popLayout">
//             {messages.length > 0 ? (
//               messages.map((msg, i) => {
//                 if (msg.role !== "user") return null;
//                 const next = messages[i + 1];
//                 const pair = next?.role === "assistant"
//                   ? { user: msg, assistant: next }
//                   : { user: msg };

//                 return (
//                   <PairedMessageRenderer
//                     key={msg.id}
//                     pair={pair}
//                     theme={theme === "dark" ? "dark" : "light"}
//                   />
//                 );
//               })
//             ) : (
//               <div className="text-center py-10 text-muted-foreground">
//                 <Bot className="mx-auto mb-2 h-7 w-7 text-primary" />
//                 Ask something about #{roomName}
//               </div>
//             )}
//           </AnimatePresence>
//         </ScrollArea>

//         {/* INPUT */}
//         <CardContent className="border-t border-border/30 p-3 bg-background/50 dark:bg-background/30">
//           <div className="relative">

//             <Textarea
//               value={prompt}
//               onChange={(e) => setPrompt(e.target.value)}
//               onKeyDown={handleKeyDown}
//               placeholder="Write your message..."
//               className={cn(
//                 "rounded-xl resize-none pr-12 text-sm",
//                 "bg-background/60 dark:bg-background/40 border-border/40",
//                 expandedInput ? "h-36" : "h-16"
//               )}
//             />

//             {/* SEND */}
//             <Button
//               type="button"
//               disabled={!prompt.trim() || loading}
//               onClick={handleSubmit}
//               className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full"
//             >
//               {loading ? (
//                 <Loader2 className="h-4 w-4 animate-spin" />
//               ) : (
//                 <Send className="h-4 w-4" />
//               )}
//             </Button>

//             {/* EXPAND TEXTAREA */}
//             <button
//               type="button"
//               onClick={() => setExpandedInput((p) => !p)}
//               className="absolute bottom-2 left-2 text-muted-foreground hover:text-foreground"
//             >
//               {expandedInput ? (
//                 <Minimize2 className="h-4 w-4" />
//               ) : (
//                 <Maximize2 className="h-4 w-4" />
//               )}
//             </button>

//           </div>
//         </CardContent>

//       </Card>
//     </div>
//   );
// }

// export default memo(RoomAssistantComponent);
