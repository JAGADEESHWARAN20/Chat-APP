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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMessage } from "@/lib/store/messages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

// Helper function to focus the main message container
const focusMessageContainer = () => {
  const messageContainer = document.getElementById("message-container") as HTMLDivElement | null;
  if (messageContainer) {
    messageContainer.focus();
  }
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
      resetActionMessage();
      return;
    }

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
    <AlertDialog open={actionType === 'delete'} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetActionMessage();
        focusMessageContainer();
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
  const { actionMessage, actionType, optimisticUpdateMessage, resetActionMessage, setActionMessage } = useMessage((state) => ({
    actionMessage: state.actionMessage,
    actionType: state.actionType,
    optimisticUpdateMessage: state.optimisticUpdateMessage,
    resetActionMessage: state.resetActionMessage,
    setActionMessage: state.setActionMessage
  }));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionType === 'edit' && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
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
      setActionMessage(actionMessage, 'delete');
      return;
    }
  };

  return (
    <Dialog open={actionType === 'edit'} onOpenChange={(isOpen) => {
      if (!isOpen) {
        // ✅ The crucial change: Blur the active element first
        // This breaks the focus trap left by the dialog
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        
        // ✅ Then, set focus on the message container with a small delay
        setTimeout(focusMessageContainer, 50); 
        resetActionMessage();
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