// components/MessasgeActions.tsx
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
import { useEffect, useRef } from "react";

// Helper to focus the chat input
const focusChatInput = () => {
  const chatInput = document.querySelector("input[placeholder*='Message']") as HTMLInputElement | null;
  chatInput?.focus();
};

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
      resetActionMessage(); // Reset state
      focusChatInput(); // Restore focus
      return;
    }

    // Optimistic UI update
    optimisticDeleteMessage(actionMessage.id);
    resetActionMessage(); // Immediately close dialog and reset state

    // API call
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("messages").delete().eq("id", actionMessage.id);

    if (error) {
      toast.error(error.message);
      // Optional: Handle re-adding the message on API failure
    } else {
      toast.success("Successfully deleted a message");
    }
    focusChatInput(); // Restore focus after action
  };

  return (
    // ✅ Use actionType from store to control `open` prop
    <AlertDialog open={actionType === 'delete'} onOpenChange={(isOpen) => {
      // If dialog is closing and it was previously open due to a delete action
      if (!isOpen && actionType === 'delete') {
        resetActionMessage(); // Reset the action in the store
        focusChatInput(); // Restore focus to chat input
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
            // ✅ onClick for Cancel should just let onOpenChange handle reset and focus
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
  const { actionMessage, actionType, optimisticUpdateMessage, resetActionMessage, optimisticDeleteMessage, setActionMessage } = useMessage((state) => ({
    actionMessage: state.actionMessage,
    actionType: state.actionType,
    optimisticUpdateMessage: state.optimisticUpdateMessage,
    resetActionMessage: state.resetActionMessage,
    optimisticDeleteMessage: state.optimisticDeleteMessage,
    setActionMessage: state.setActionMessage // Needed to trigger delete dialog
  }));

  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ Use an effect to focus the input only when this specific dialog is open
  useEffect(() => {
    if (actionType === 'edit' && inputRef.current) {
      setTimeout(() => { // Small delay to ensure dialog is rendered
        inputRef.current?.focus();
      }, 100);
    }
  }, [actionType]); // Depend on actionType to trigger focus

  const handleEdit = async () => {
    if (!actionMessage?.id || !inputRef.current) {
      toast.error("No message selected for editing");
      resetActionMessage(); // Reset state
      focusChatInput(); // Restore focus
      return;
    }

    const text = inputRef.current.value.trim();

    if (text) {
      // Optimistic UI update
      optimisticUpdateMessage(actionMessage.id, { text, is_edited: true });
      resetActionMessage(); // Immediately close dialog and reset state

      // API call
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("messages")
        .update({ text, is_edited: true })
        .eq("id", actionMessage.id);

      if (error) {
        toast.error(error.message);
        // Optional: Handle re-adding original message on API failure
      } else {
        toast.success("Update Successful");
      }
    } else {
      // If empty, close EditAlert and open DeleteAlert for confirmation
      resetActionMessage(); // Close edit dialog first
      // ✅ Now explicitly set the action to 'delete' for the same message
      setActionMessage(actionMessage, 'delete');
      // The DeleteAlert component will now open automatically.
      return; // Exit here, as DeleteAlert will handle the rest
    }
    focusChatInput(); // Restore focus after action
  };

  return (
    // ✅ Use actionType from store to control `open` prop
    <Dialog open={actionType === 'edit'} onOpenChange={(isOpen) => {
      // If dialog is closing and it was previously open due to an edit action
      if (!isOpen && actionType === 'edit') {
        resetActionMessage(); // Reset the action in the store
        focusChatInput(); // Restore focus to chat input
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
            // ✅ onClick for Cancel should just let onOpenChange handle reset and focus
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