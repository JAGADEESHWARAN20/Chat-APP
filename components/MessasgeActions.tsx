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
import { X } from "lucide-react";
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
      // If text is empty, treat as delete
      resetActionMessage();
      setActionMessage(actionMessage, "delete");
    }

    // Ensure proper cleanup
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleCancel = () => {
    resetActionMessage();
    focusMessageContainerSafely();
  };

  if (actionType !== 'edit') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Message
          </h2>
          <Button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Input
          defaultValue={actionMessage?.text || ""}
          ref={inputRef}
          className="mb-4 dark:bg-gray-800 dark:text-gray-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleEdit();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
        />

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="dark:bg-gray-800 dark:text-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleEdit}
            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
