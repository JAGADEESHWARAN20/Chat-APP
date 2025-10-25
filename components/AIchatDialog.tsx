"use client";

import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import RoomAssistantComponent from "./RoomAssistant"; // adjust import path

interface RoomAssistantDialogProps {
  roomId: string;
  roomName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomAssistantDialog({ 
  roomId, 
  roomName,
  open,
  onOpenChange
}: RoomAssistantDialogProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
        <div className="h-full">
          <RoomAssistantComponent
            roomId={roomId}
            roomName={roomName}
            className="h-full border-0 shadow-none"
            dialogMode={true}
            onCloseDialog={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}