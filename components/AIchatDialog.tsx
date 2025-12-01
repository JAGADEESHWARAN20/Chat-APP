import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Bot, X } from "lucide-react";
import RoomAssistantComponent from "./RoomAssistant";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./RoomAssistant";


// import { MessageSkeleton } from "./RoomAssistantParts/MessageSkeleton";

export function RoomAssistantDialog({ roomId, roomName, triggerButton }: any) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!open || !roomId) return;
  
    let active = true;
  
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/ai-chat/history?roomId=${roomId}`);
        const data = await res.json();
  
        if (active && data.success) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Failed to load AI history", err);
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
  
    loadHistory();
  
    return () => { active = false; };
  }, [open, roomId]);
    
  const defaultTrigger = (
    <Button variant="ghost" size="icon">
      <Bot className="h-5 w-5" />
    </Button>
  );
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton || defaultTrigger}</DialogTrigger>

      <DialogContent
        hideCloseButton
        className={cn(
          "overflow-hidden flex flex-col transition-all border-transparent border-0 rounded-lg  duration-300",
          isExpanded
            ? "w-[95vw] h-[90vh]"
            : "w-[85vw] h-[58vh]"
        )}
      >
        <DialogTitle className="sr-only">AI Chat</DialogTitle>
        <DialogDescription className="sr-only">AI Assistant</DialogDescription>

        <DialogClose asChild>
          <Button className="absolute top-3 right-3 h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center">
            <X className="h-3.5 w-3.5" />
          </Button>
        </DialogClose>

        <RoomAssistantComponent
  roomId={roomId}
  roomName={roomName}
  dialogMode
  isExpanded={isExpanded}
  onToggleExpand={() => setIsExpanded(!isExpanded)}
  messages={messages}
  setMessages={setMessages}
  loadingHistory={historyLoading}
/>

      </DialogContent>
    </Dialog>
  );
}
