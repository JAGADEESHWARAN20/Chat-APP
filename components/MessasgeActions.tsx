// components/MessageActions.tsx
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
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMessage } from "@/lib/store/messages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

/**
 * Safely focus the main scroll container after a dialog closes.
 * Uses rAF to wait until Radix unmounts the portal & overlay.
 */
function focusMessageContainerSafely() {
  const tryFocus = () => {
    const el = document.getElementById("message-container") as HTMLDivElement | null;
    if (el) el.focus();
  };
  // one frame to let close propagate, another to ensure portal unmount
  requestAnimationFrame(() => requestAnimationFrame(tryFocus));
}

export function DeleteAlert() {
  const { actionMessage, actionType, optimisticDeleteMessage, resetActionMessage } = useMessage((state) => ({
    actionMessage: state.actionMessage,
    actionType: state.actionType,
    optimisticDeleteMessage: state.optimisticDeleteMessage,
    resetActionMessage: state.resetActionMessage,
  }));

  const handleDeleteMessage = async () => {
    if (!actionMessage?.id) {
      toast.error("No message selected for deletion");
      resetActionMessage();
      return;
    }

    // Optimistic
    optimisticDeleteMessage(actionMessage.id);
    resetActionMessage();

    const supabase = supabaseBrowser();
    const { error } = await supabase.from("messages").delete().eq("id", actionMessage.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Successfully deleted a message");
    }
  };

  return (
    <AlertDialog
      open={actionType === "delete"}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          // break any leftover focus
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          resetActionMessage();
          focusMessageContainerSafely();
        }
      }}
    >
      <AlertDialogContent
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the message from the chat.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* AlertDialogCancel will call onOpenChange(false) automatically */}
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
  const { actionMessage, actionType, optimisticUpdateMessage, resetActionMessage, setActionMessage } = useMessage(
    (state) => ({
      actionMessage: state.actionMessage,
      actionType: state.actionType,
      optimisticUpdateMessage: state.optimisticUpdateMessage,
      resetActionMessage: state.resetActionMessage,
      setActionMessage: state.setActionMessage,
    })
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionType === "edit" && inputRef.current) {
     
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [actionType]);

  const handleEdit = async () => {
    if (!actionMessage?.id || !inputRef.current) {
      toast.error("No message selected for editing");
      resetActionMessage();
      return;
    }

    const text = inputRef.current.value.trim();

    if (text) {
      // optimistic
      optimisticUpdateMessage(actionMessage.id, { text, is_edited: true });
      resetActionMessage();

      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("messages")
        .update({ text, is_edited: true })
        .eq("id", actionMessage.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Update Successful");
      }
    } else {
     
      resetActionMessage();
      setActionMessage(actionMessage, "delete");
    }
  };

  return (
      <Dialog
  open={actionType === 'edit'}
  onOpenChange={(isOpen) => {
    if (!isOpen) resetActionMessage();
  }}
>
    
  <DialogContent
    className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full"
    onOpenAutoFocus={(e) => e.preventDefault()}
  >
    <DialogHeader>
      <DialogTitle>Edit Message</DialogTitle>
    </DialogHeader>

    <Input
      defaultValue={actionMessage?.text || ""}
      ref={inputRef}
      className="dark:bg-gray-800 dark:text-gray-100"
    />

    <DialogFooter>
      <Button asChild variant="outline" className="dark:bg-gray-800 dark:text-gray-100">
        <DialogClose>Cancel</DialogClose>
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
