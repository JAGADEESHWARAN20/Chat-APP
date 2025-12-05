// components/CreateRoomDialog.tsx
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
            "transition-all duration-200"
          )}
          style={{
            background: "hsl(var(--action-bg))",
            border: "1px solid hsl(var(--action-ring))",
            boxShadow: "var(--shadow, 0 2px 6px rgba(0,0,0,0.08))",
          }}
          aria-label="Create room"
        >
          <PlusCircle
            className="h-[2em] w-[2em]"
            style={{ color: "hsl(var(--action-active))" }}
          />
        </motion.button>
      </DialogTrigger>

      <DialogContent
        hideCloseButton
        className={cn(
          "relative flex flex-col items-center justify-center",
          "rounded-2xl shadow-xl p-6 sm:p-8 fixed inset-0 m-auto"
        )}
        style={{
          backgroundColor: "hsl(var(--background))",
          border: "1px solid hsl(var(--border))",
          color: "hsl(var(--foreground))",
          width: "min(90vw, 720px)",
          maxWidth: "720px",
          minHeight: "40vh",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          boxSizing: "border-box",
        }}
      >
        <DialogHeader className="w-full mb-4 text-center" style={{ position: "relative" }}>
          <DialogTitle
            className="text-xl font-semibold"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Create New Room
          </DialogTitle>

          <DialogClose asChild>
            <Button
              className="absolute top-3 right-3 h-9 w-9 rounded-full"
              style={{
                background: "hsl(var(--muted) / 0.6)",
                border: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close create room dialog"
            >
              <X className="h-4 w-4" style={{ color: "hsl(var(--foreground))" }} />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="grid w-full gap-4 py-2" style={{ width: "100%" }}>
          <div className="space-y-2">
            <Label htmlFor="roomName" style={{ color: "hsl(var(--muted-foreground))" }}>
              Room Name
            </Label>
            <Input
              id="roomName"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              disabled={isCreating}
              style={{
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                borderColor: "hsl(var(--border))",
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isCreating}
            />
            <Label style={{ color: "hsl(var(--muted-foreground))" }}>Private Room</Label>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3 w-full mt-4">
          <Button
            variant="ghost"
            disabled={isCreating}
            onClick={() => setIsDialogOpen(false)}
            style={{
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
              border: "1px solid transparent",
            }}
          >
            Cancel
          </Button>

          <Button
            disabled={isCreating}
            onClick={handleCreateRoom}
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              border: "1px solid hsl(var(--primary) / 0.25)",
            }}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
