"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Imessage, useMessage } from "@/lib/store/messages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRef } from "react";

export function DeleteAlert() {
  const actionMessage = useMessage((state) => state.actionMessage);
  const optimisticDeleteMessage = useMessage(
    (state) => state.optimisticDeleteMessage
  );

  const handleDeleteMessage = async () => {
    if (!actionMessage?.id) {
      console.error("[DeleteAlert] No message selected for deletion");
      toast.error("No message selected for deletion");
      return;
    }

    console.log("[DeleteAlert] Deleting message:", actionMessage.id);
    const supabase = supabaseBrowser();
    optimisticDeleteMessage(actionMessage.id);

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", actionMessage.id);

    if (error) {
      console.error("[DeleteAlert] Supabase Delete Error:", error);
      toast.error(error.message);
    } else {
      console.log("[DeleteAlert] Message deleted successfully");
      toast.success("Successfully deleted a message");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* ✅ Accessibility fix: Add aria-label for screen readers */}
        <button
          id="trigger-delete"
          aria-label="Delete message"
          className="hidden"
        />
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            message from the chat.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="dark:bg-gray-800 dark:text-gray-100">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            onClick={handleDeleteMessage}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EditAlert() {
  const actionMessage = useMessage((state) => state.actionMessage);
  const optimisticUpdateMessage = useMessage(
    (state) => state.optimisticUpdateMessage
  );

  const inputRef = useRef() as React.MutableRefObject<HTMLInputElement>;

  const handleEdit = async () => {
    if (!actionMessage?.id) {
      console.error("[EditAlert] No message selected for editing");
      toast.error("No message selected for editing");
      return;
    }

    const text = inputRef.current.value.trim();
    console.log("[EditAlert] Editing message:", actionMessage.id, { text });

    if (text) {
      optimisticUpdateMessage(actionMessage.id, { text, is_edited: true });
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("messages")
        .update({ text, is_edited: true })
        .eq("id", actionMessage.id);

      if (error) {
        console.error("[EditAlert] Supabase Update Error:", error);
        toast.error(error.message);
      } else {
        console.log("[EditAlert] Message updated successfully");
        toast.success("Update Successfully");
      }
      document.getElementById("trigger-edit")?.click();
    } else {
      console.log("[EditAlert] Empty message text, triggering delete");
      document.getElementById("trigger-edit")?.click();
      document.getElementById("trigger-delete")?.click();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* ✅ Accessibility fix */}
        <button
          id="trigger-edit"
          aria-label="Edit message"
          className="hidden"
        />
      </DialogTrigger>
      <DialogContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
        </DialogHeader>
        <Input
          defaultValue={actionMessage?.text}
          ref={inputRef}
          className="dark:bg-gray-800 dark:text-gray-100"
        />
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleEdit}
            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
