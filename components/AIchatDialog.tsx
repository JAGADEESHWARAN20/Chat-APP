"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Bot } from "lucide-react";
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
  triggerButton 
}: RoomAssistantDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultTrigger = (
    <Button variant="ghost" size="icon">
      <Bot className="h-5 w-5" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>

      <DialogContent className={cn(
        "h-[70vh] max-h-[90vh] p-0 overflow-hidden transition-all duration-300 ease-in-out [&>button]:hidden sm:h-[60vh] sm:max-h-[80vh] xl:max-h-[85vh]",
        isExpanded 
          ? "w-[95vw] max-w-[98vw] h-[85vh] sm:w-[90vw] lg:w-[92vw] xl:w-[95vw]" 
          : "w-[85vw] max-w-[90vw] sm:w-[75vw] lg:w-[80vw] xl:w-[85vw]"
      )}>
        <div className="h-full">
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