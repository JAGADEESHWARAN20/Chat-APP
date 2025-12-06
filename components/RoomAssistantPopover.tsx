"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import RoomAssistantComponent, { ChatMessage } from "./RoomAssistant";
import { cn } from "@/lib/utils";

export function RoomAssistantPopover({
  roomId,
  roomName,
  triggerButton,
}: {
  roomId?: string | null;
  roomName?: string | null;
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputExpanded, setInputExpanded] = useState(false);

  useEffect(() => {
    if (!open || !roomId) return;
    let active = true;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/ai-chat/history?roomId=${roomId}`);
        const data = await res.json();
        if (active && data?.success) setMessages(data.messages || []);
      } catch {
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => { active = false };
  }, [open, roomId]);

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      title="AI Assistant"
      className={cn(
        "flex items-center justify-center rounded-full shadow-lg",
        "transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
      )}
      style={{
        width: "2.9rem",
        height: "2.9rem",
        backgroundColor: "hsl(var(--background) / 0.7)",
        border: "1px solid hsl(var(--border) / 0.25)",
      }}
    >
      <Bot className="h-[1.15rem] w-[1.15rem] text-[hsl(var(--muted-foreground))]" />
    </Button>
  );

  const translateY = inputExpanded ? "-2.75rem" : "-1.25rem";

  const handleInputExpandChange = useCallback((expanded: boolean) => {
    setInputExpanded(expanded);
  }, []);

  const widthValue = isExpanded
    ? "clamp(90vw, 460px, 760px)"
    : "clamp(88vw, 380px, 560px)";

  return (
    <div
      aria-hidden={false}
      className="absolute right-4 bottom-[2em] md:bottom-6 z-[9999] flex items-end"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div>{triggerButton || defaultTrigger}</div>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          className={cn(
            "p-0 rounded-2xl shadow-xl overflow-hidden",
            "border border-[hsl(var(--border)/0.12)]",
            "bg-[hsl(var(--background)/0.95)]"
          )}
          style={{
            width: widthValue,
            display: "flex",
            flexDirection: "column",
            transform: `translateY(${translateY}) translateX(-0.25rem)`,
          }}
        >
          <RoomAssistantComponent
            roomId={roomId || ""}
            roomName={roomName || ""}
            dialogMode={false}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((v) => !v)}
            messages={messages}
            setMessages={setMessages}
            loadingHistory={historyLoading}
            onInputExpandChange={handleInputExpandChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default RoomAssistantPopover;
