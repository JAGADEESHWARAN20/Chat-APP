// components/RoomAssistantPopover.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import RoomAssistantComponent, { ChatMessage } from "./RoomAssistant";
import { cn } from "@/lib/utils";

/**
 * RoomAssistantPopover
 *
 * Responsive popover that adjusts translateY when the input expands.
 */
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
  const [isExpanded, setIsExpanded] = useState(false); // full popover expand
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
    <Button
      variant="ghost"
      size="icon"
      title="AI Assistant"
      className="flex items-center justify-center"
      style={{
        width: "2.6em",
        height: "2.6em",
        borderRadius: "9999px",
        backgroundColor: "hsl(var(--background) / 0.6)",
        border: "1px solid hsl(var(--border) / 0.3)",
        boxShadow: "0 8px 20px rgba(2,6,23,0.08)",
      }}
    >
      <Bot className="h-5 w-5" />
    </Button>
  );

  // dynamic translateY based on whether input is expanded (so popover lifts)
  const translateY = inputExpanded ? "-1.5rem" : "-1.5rem";

  // When RoomAssistant toggles its input expand, we update this state.
  const handleInputExpandChange = useCallback((expanded: boolean) => {
    setInputExpanded(expanded);
  }, []);

  // PopoverContent max heights (vh) - responsive
  
  const widthValue = isExpanded ? "min(92vw, 760px)" : "min(82vw, 560px)";

  return (
    <div aria-hidden={false} className="fixed right-6 md:bottom-6 bottom-[7em] z-[9999]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div>{triggerButton || defaultTrigger}</div>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className={cn(
            "p-0 rounded-2xl shadow-xl",
            "border border-[hsl(var(--border)/0.12)] bg-[hsl(var(--background)/0.95)]",
            // keep overflow hidden on popover; internal content should scroll
            "overflow-hidden"
          )}
          style={{
            width: widthValue,
            display: "flex",
            flexDirection: "column",
            padding: 0,
            // nudge popover up so it doesn't overlap trigger; adjust dynamically when input expands
            transform: `translateY(${translateY})`,
          }}
        >
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
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
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default RoomAssistantPopover;
