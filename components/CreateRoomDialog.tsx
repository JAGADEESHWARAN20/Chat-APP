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
import { toast } from "@/components/ui/sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRoomActions } from "@/lib/store/unified-roomstore";

export default function CreateRoomDialog({ user }: { user: SupabaseUser | undefined }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { createRoom } = useRoomActions();

  const handleCreateRoom = async () => {
    if (!user) return toast.error("You must be logged in");

    if (!newRoomName.trim()) return toast.error("Room name cannot be empty");

    setIsCreating(true);

    try {
      await createRoom(newRoomName.trim(), isPrivate);

      toast.success("Room created successfully!");
      setNewRoomName("");
      setIsPrivate(false);
      setIsDialogOpen(false);

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
          className={cn(
            "flex items-center justify-center rounded-full w-[2.6em] h-[2.6em]",
            "bg-[var(--action-bg)] border border-[var(--action-ring)] shadow-sm",
            "transition-all duration-200 hover:bg-[var(--action-hover)]"
          )}
        >
          <PlusCircle className="h-[2em] w-[2em] text-[var(--action-active)]" />
        </motion.button>
      </DialogTrigger>

      <DialogContent
        hideCloseButton
        className={cn(
          "relative flex flex-col items-center justify-center",
          "bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-xl",
          "p-6 sm:p-8 fixed inset-0 m-auto",
          "w-[90vw] max-w-lg min-h-[40vh]",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
      >
        <DialogHeader className="w-full mb-4 text-center">
          <DialogTitle className="text-xl font-semibold">Create New Room</DialogTitle>
          <DialogClose asChild>
            <Button className="absolute top-3 right-3 h-9 w-9 rounded-full bg-[hsl(var(--muted))]/60">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="grid w-full gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isCreating}
            />
            <Label>Private Room</Label>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3 w-full mt-4">
          <Button variant="ghost" disabled={isCreating} onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>

          <Button disabled={isCreating} onClick={handleCreateRoom}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
