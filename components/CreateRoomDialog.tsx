"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { PlusCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRoomContext } from "@/lib/store/RoomContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function CreateRoomDialog({ user }: { user: SupabaseUser | undefined }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { createRoom } = useRoomContext();

  const handleCreateRoom = async () => {
    if (!user) {
      toast.error("You must be logged in to create a room");
      return;
    }
    if (!newRoomName.trim()) {
      toast.error("Room name cannot be empty");
      return;
    }
    setIsCreating(true);
    try {
      await createRoom(newRoomName.trim(), isPrivate);
      setNewRoomName("");
      setIsPrivate(false);
      setIsDialogOpen(false);
      toast.success("Room created successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <motion.button
          whileHover={{ scale: 1 }}
          whileTap={{ scale: 1 }}
          title="Create Room"
          className={cn(
            "flex items-center justify-center rounded-full w-[2.6em] h-[2.6em]",
            "bg-[var(--action-bg)] border border-[var(--action-ring)] shadow-sm",
            "transition-all duration-200 hover:bg-[var(--action-hover)] hover:shadow-lg"
          )}
        >
          <PlusCircle
            className="h-[1.6em] w-[1.6em] text-[var(--action-active)] transition-colors duration-200 group-hover:fill-[var(--action-active)]"
          />
        </motion.button>
      </DialogTrigger>
     
      <DialogContent
      hideCloseButton
  className={cn(
    // ✅ Core layout
    "relative flex flex-col items-center justify-center",
    "bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-xl backdrop-blur-md",
    "p-6 sm:p-8",
    // ✅ Centering on all devices
    "fixed inset-0 m-auto",
    "w-[90vw] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl",
    "min-h-[50vh] sm:min-h-[40vh] md:min-h-[35vh]",
    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "transition-all duration-300 ease-in-out"
  )}
>

  {/* Header */}
  <DialogHeader className="w-full mb-4 text-center">
    <DialogTitle className="text-xl sm:text-2xl font-semibold text-foreground">
      Create New Room
    </DialogTitle>
    <DialogClose asChild>
    <Button
      className="
        absolute top-3 right-3 z-50 
        h-9 w-9 flex items-center justify-center 
        rounded-full 
        bg-[hsl(var(--muted))]/60 
        border border-[hsl(var(--border))/40]
        hover:bg-[hsl(var(--action-active))]/15 
        text-[hsl(var(--foreground))]/80 
        transition-all
      "
    >
      <X className="h-4 w-4" />
    </Button>
  </DialogClose>
  </DialogHeader>

  {/* Body */}
  <div className="grid w-full gap-4 py-2">
    <div className="space-y-2">
      <Label htmlFor="roomName" className="text-foreground font-medium">
        Room Name
      </Label>
      <Input
        id="roomName"
        placeholder="Enter room name"
        value={newRoomName}
        onChange={(e) => setNewRoomName(e.target.value)}
        disabled={isCreating}
        className={cn(
          "w-full border border-border bg-background",
          "rounded-lg focus:ring-2 focus:ring-[var(--action-ring)]",
          "transition-all duration-200"
        )}
      />
    </div>

    <div className="flex items-center gap-3">
      <Switch
        id="private"
        checked={isPrivate}
        onCheckedChange={setIsPrivate}
        disabled={isCreating}
        className="data-[state=checked]:bg-[var(--action-active)]"
      />
      <Label htmlFor="private" className="text-foreground font-medium">
        Private Room
      </Label>
    </div>
  </div>

  {/* Footer */}
  <DialogFooter className="flex justify-end gap-3 w-full mt-4">
    <Button
      variant="ghost"
      onClick={() => setIsDialogOpen(false)}
      disabled={isCreating}
      className="text-[var(--action-text)] hover:bg-[var(--action-hover)] transition-all duration-200"
    >
      Cancel
    </Button>
    <Button
      onClick={handleCreateRoom}
      disabled={isCreating}
      className={cn(
        "bg-[var(--action-active)] hover:bg-[var(--action-ring)] text-white",
        "shadow-md px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-200"
      )}
    >
      {isCreating ? "Creating..." : "Create"}
    </Button>
  </DialogFooter>
</DialogContent>

    </Dialog>
  );
}
