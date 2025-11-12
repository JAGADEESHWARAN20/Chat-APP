"use client";

import React, { useState } from "react";
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
          "p-0 overflow-hidden flex flex-col transition-all duration-300 ease-in-out",
          isExpanded
            ? "w-[95vw] lg:w-[85vw] h-[90vh] max-h-[95vh]"
            : "w-[85vw] lg:w-[65vw] h-[55vh] max-h-[55vh]"
        )}
      >
        <DialogTitle className="sr-only">AI Assistant</DialogTitle>
        <DialogDescription className="sr-only">
          Chat with AI Assistant about this room
        </DialogDescription>

        <DialogClose asChild>
          <button
            className="absolute top-3 right-3 z-50 h-9 w-9 flex items-center justify-center rounded-full 
              bg-[hsl(var(--muted))]/60 border border-[hsl(var(--border))/40]
              hover:bg-[hsl(var(--muted))]/80 text-[hsl(var(--foreground))]/80 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>

        <div className="flex-1 h-auto overflow-hidden">
          <RoomAssistantComponent
            key={roomId} // 🧠 ensures clean remount per room
            roomId={roomId}
            roomName={roomName}
            className="h-full border-0 shadow-none"
            dialogMode
            onCloseDialog={() => setOpen(false)}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
