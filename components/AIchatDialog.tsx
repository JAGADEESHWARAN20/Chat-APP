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

export function RoomAssistantDialog({ roomId, roomName, triggerButton }: any) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
          "p-0 overflow-hidden flex flex-col transition-all duration-300",
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
        />
      </DialogContent>
    </Dialog>
  );
}
