"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRoomContext } from "@/lib/store/RoomContext";

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <button title="create Room" className={`w-[2em] h-[2em] p-[.35em]  flex items-center `}>
          <PlusCircle className="h-5 w-5 text-black dark:text-gray-300 hover:fill-gray-700 dark:hover:fill-slate-50 duration-100 transition-colors" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[2em] font-bold">Create New Room</DialogTitle>
        </DialogHeader>

        <div className="grid gap-[1.2em] py-[1em]">
          <div className="space-y-[0.6em]">
            <Label htmlFor="roomName" className="text-[1em] font-medium text-foreground">
              Room Name
            </Label>
            <Input
              id="roomName"
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              disabled={isCreating}
              className="
                bg-background
                border
                border-border
                text-foreground
                placeholder:text-muted-foreground
                rounded-lg
                focus-visible:ring-1
                focus-visible:ring-indigo-500
                focus-visible:border-indigo-500
                transition-all
              "
            />
          </div>

          <div className="flex items-center space-x-[1em]">
            <Switch
              id="private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isCreating}
              className="
                data-[state=checked]:bg-indigo-600
                data-[state=unchecked]:bg-muted
              "
            />
            <Label htmlFor="private" className="text-[1em] font-medium text-foreground">
              Private Room
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isCreating}
            className="
              bg-transparent
              border-border
              text-foreground
              hover:bg-muted
              hover:text-foreground
              rounded-lg
              transition-colors
            "
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="
              bg-indigo-600
              hover:bg-indigo-700
              text-white
              rounded-lg
              transition-colors
            "
          >
            {isCreating ? "Creating..." : "Create Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
