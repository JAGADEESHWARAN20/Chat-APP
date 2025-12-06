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
  const [expanded, setExpanded] = useState(false); // THE ONLY SIZE STATE OWNER
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
      } catch {}
      finally {
        if (active) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => { active = false };
  }, [open, roomId]);

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      title="AI Assistant"
      className="flex items-center justify-center rounded-full shadow-lg transition-all duration-200  active:scale-[0.96]"
      style={{
        width: "4rem",
        height: "4rem",
        backgroundColor: "hsl(var(--action-text) )",
        border: "1px solid hsl(var(--border) / 0.25)",
      }}
    >
      <Bot className="h-[2em] w-[2em]  text-[hsl(var(--action-hover))]" />
    </Button>
  );

  /** Popover height + width dynamically governed by expand state */
  const popoverWidth = expanded
    ? "min(95vw, 760px)"
    : "min(88vw, 520px)";

  const popoverHeight = expanded
    ? "80vh"
    : "62vh";

  /** Child expands internal textarea → nudge UI */
  const handleInputExpandChange = useCallback((expandedInput: boolean) => {
    setInputExpanded(expandedInput);
  }, []);

  /** RoomAssistant wants to expand the whole panel → we toggle popover size */
  const handleFullExpandToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <div
      aria-hidden={false}
      className="absolute right-4 bottom-[0em] md:bottom-6 z-[9999] pointer-events-none"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="pointer-events-auto">
            {triggerButton || trigger}
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          className={cn(
            "p-0 rounded-2xl shadow-xl overflow-hidden duration-100 transition-all pointer-events-auto",
            "border border-[hsl(var(--border)/0.15)]",
            "bg-[hsl(var(--background)/0.95)] backdrop-blur-xl"
          )}
          style={{
            width: popoverWidth,
            height: popoverHeight,
            display: "flex",
            flexDirection: "column",
            transform: `translateY(${inputExpanded ? "-1rem" : "-0.5rem"}) translateX(-0.25rem)`
          }}
        >
          <RoomAssistantComponent
            roomId={roomId ?? ""}
            roomName={roomName ?? ""}
            dialogMode={false}
            isExpanded={expanded}
            onToggleExpand={handleFullExpandToggle}
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
