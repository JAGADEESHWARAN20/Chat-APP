"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Bot, Maximize2 } from "lucide-react";
import RoomAssistantComponent from "./RoomAssistant"; // adjust import path

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
    <Button variant="outline" size="sm" className="gap-2">
      <Bot className="h-4 w-4" />
      AI Assistant
      <Maximize2 className="h-3 w-3" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
        <div className="h-full">
          <RoomAssistantComponent
            roomId={roomId}
            roomName={roomName}
            className="h-full border-0 shadow-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}