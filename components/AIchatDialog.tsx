"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Bot, X } from "lucide-react";
import RoomAssistantComponent from "./RoomAssistant";
import { cn } from "@/lib/utils";

interface RoomAssistantDialogProps {
  roomId: string;
  roomName: string;
  triggerButton?: React.ReactNode;
}

export function RoomAssistantDialog({
  roomId,
  roomName,
  triggerButton,
}: RoomAssistantDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultTrigger = (
    <Button variant="ghost" size="icon" className="rounded-full">
      <Bot className="h-5 w-5" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton || defaultTrigger}</DialogTrigger>

      <DialogContent
        hideCloseButton
        className={cn(
          "p-0 overflow-hidden transition-all duration-300 ease-in-out flex flex-col",
          isExpanded
            ? "w-[95vw] lg:w-[85vw] h-[90vh] md:h-[90vh] max-w-[98vw] max-h-[95vh]"
            : "w-[85vw] lg:w-[65vw] h-[75vh] md:h-[75vh] max-w-[90vw] max-h-[85vh]"
        )}
      >
        {/* Custom close button */}
        <DialogClose asChild>
          <button
            className="
              absolute top-3 right-3 z-50 
              h-9 w-9 flex items-center justify-center 
              rounded-full 
              bg-[hsl(var(--muted))]/60 
              border border-[hsl(var(--border))/40]
              hover:bg-[hsl(var(--muted))]/80 
              text-[hsl(var(--foreground))]/80 
              transition-all
            "
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>

        {/* Ensures the assistant fills entire dialog */}
        <div className="flex-1 h-full overflow-hidden">
          <RoomAssistantComponent
            roomId={roomId}
            roomName={roomName}
            className="h-full border-0 shadow-none"
            dialogMode={true}
            onCloseDialog={() => setOpen(false)}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
