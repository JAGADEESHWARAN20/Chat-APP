"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Bot, X } from "lucide-react";
import RoomAssistantComponent from "./RoomAssistant";

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
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden [&>button]:hidden">
        {/* Custom close button positioned where you want */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          className="absolute right-6 top-6 z-50 h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="h-full">
          <RoomAssistantComponent
            roomId={roomId}
            roomName={roomName}
            className="h-full border-0 shadow-none"
            dialogMode={true}
            onCloseDialog={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}