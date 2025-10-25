"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Bot } from "lucide-react";
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
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden [&>button]:right-6 [&>button]:top-6 [&>button]:bg-background/80 [&>button]:backdrop-blur-sm [&>button]:border [&>button]:border-border [&>button]:hover:bg-accent [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-lg">
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