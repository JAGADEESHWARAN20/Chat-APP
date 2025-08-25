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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Imessage, useMessage } from "@/lib/store/messages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

export function DeleteAlert() {
  const actionMessage = useMessage((state) => state.actionMessage);
  const optimisticDeleteMessage = useMessage((state) => state.optimisticDeleteMessage);
  const resetActionMessage = useMessage((state) => state.resetActionMessage);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (actionMessage && actionMessage.id) {
      setOpen(true);
    }
  }, [actionMessage]);

  const handleDeleteMessage = async () => {
    if (!actionMessage?.id) {
      console.error("[DeleteAlert] No message selected for deletion");
      toast.error("No message selected for deletion");
      setOpen(false);
      resetActionMessage();
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

    setOpen(false);
    resetActionMessage();
    // ✅ Type assertion here
    const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
    chatInput?.focus();
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetActionMessage();
        // ✅ Type assertion here
        const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
        chatInput?.focus();
      }
    }}>
      <AlertDialogContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the message from the chat.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="dark:bg-gray-800 dark:text-gray-100"
            onClick={() => {
              setOpen(false);
              resetActionMessage();
              // ✅ Type assertion here
              const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
              chatInput?.focus();
            }}
          >
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
  const optimisticUpdateMessage = useMessage((state) => state.optimisticUpdateMessage);
  const resetActionMessage = useMessage((state) => state.resetActionMessage);
  const optimisticDeleteMessage = useMessage((state) => state.optimisticDeleteMessage);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionMessage && actionMessage.id) {
      setOpen(true);
      // When the dialog opens, focus the input field
      // This needs a slight delay to ensure the dialog is fully rendered and the input is available
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100); 
    }
  }, [actionMessage]); // Removed `open` from dependency array to avoid infinite loop

  const handleEdit = async () => {
    if (!actionMessage?.id) {
      console.error("[EditAlert] No message selected for editing");
      toast.error("No message selected for editing");
      setOpen(false);
      resetActionMessage();
      return;
    }

    const text = inputRef.current?.value.trim();
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
    } else {
      console.log("[EditAlert] Empty message text, prompting for deletion");
      // ✅ Replaced window.confirm with toast.confirm for better UX and consistency
      toast.info("Message is empty. Do you want to delete it?", {
        action: {
          label: "Delete",
          onClick: async () => {
            optimisticDeleteMessage(actionMessage.id);
            const supabase = supabaseBrowser();
            const { error } = await supabase
              .from("messages")
              .delete()
              .eq("id", actionMessage.id);

            if (error) {
              toast.error(error.message);
            } else {
              toast.success("Successfully deleted a message");
            }
          },
        },
        duration: 5000, // Give user time to decide
        onDismiss: () => {
          // If user dismisses without deleting, simply close dialog
          setOpen(false);
          resetActionMessage();
          const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
          chatInput?.focus();
        }
      });
    }

    setOpen(false);
    resetActionMessage();
    // ✅ Type assertion here
    const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
    chatInput?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetActionMessage();
        // ✅ Type assertion here
        const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
        chatInput?.focus();
      }
    }}>
      <DialogContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
        </DialogHeader>
        <Input
          defaultValue={actionMessage?.text || ""}
          ref={inputRef}
          className="dark:bg-gray-800 dark:text-gray-100"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetActionMessage();
              // ✅ Type assertion here
              const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
              chatInput?.focus();
            }}
            className="dark:bg-gray-800 dark:text-gray-100"
          >
            Cancel
          </Button>
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