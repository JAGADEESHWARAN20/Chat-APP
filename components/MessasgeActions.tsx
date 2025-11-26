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
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useMessage } from "@/lib/store/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

// CSS Variables from your theme
const CSS_VARS = {
  // Background colors
  background: 'hsl(var(--background))',
  card: 'hsl(var(--card))',
  popover: 'hsl(var(--popover))',
  
  // Text colors
  foreground: 'hsl(var(--foreground))',
  cardForeground: 'hsl(var(--card-foreground))',
  popoverForeground: 'hsl(var(--popover-foreground))',
  mutedForeground: 'hsl(var(--muted-foreground))',
  destructive: 'hsl(var(--destructive))',
  destructiveForeground: 'hsl(var(--destructive-foreground))',
  
  // Border colors
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  
  // Primary colors
  primary: 'hsl(var(--primary))',
  primaryForeground: 'hsl(var(--primary-foreground))',
  
  // Secondary colors
  secondary: 'hsl(var(--secondary))',
  secondaryForeground: 'hsl(var(--secondary-foreground))',
  
  // Action colors
  actionBg: 'var(--action-bg)',
  actionHover: 'var(--action-hover)',
  actionActive: 'var(--action-active)',
  actionText: 'var(--action-text)',
  

  zTop: 'var(--z-top)',
} as const;

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

    const supabase = getSupabaseBrowserClient();
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
        style={{
          backgroundColor: CSS_VARS.background,
          color: CSS_VARS.foreground,
          
        }}
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ color: CSS_VARS.foreground }}>
            Are you absolutely sure?
          </AlertDialogTitle>
          <AlertDialogDescription style={{ color: CSS_VARS.mutedForeground }}>
            This action cannot be undone. This will permanently delete the message from the chat.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            style={{
              backgroundColor: CSS_VARS.secondary,
              color: CSS_VARS.secondaryForeground,
              borderColor: CSS_VARS.border,
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            style={{
              backgroundColor: CSS_VARS.destructive,
              color: CSS_VARS.destructiveForeground,
            }}
            onClick={handleDeleteMessage}
            className="hover:opacity-90 transition-opacity"
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

      const supabase = getSupabaseBrowserClient();
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
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: CSS_VARS.zTop }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div 
        className="relative rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        style={{
          backgroundColor: CSS_VARS.background,
          color: CSS_VARS.foreground,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 
            className="text-xl font-semibold"
            style={{ color: CSS_VARS.foreground }}
          >
            Edit Message
          </h2>
          <Button
            onClick={handleCancel}
            style={{
              backgroundColor: 'transparent',
              color: CSS_VARS.mutedForeground,
            }}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Input
          defaultValue={actionMessage?.text || ""}
          ref={inputRef}
          style={{
            backgroundColor: CSS_VARS.input,
            color: CSS_VARS.foreground,
            borderColor: CSS_VARS.border,
          }}
          className="mb-4"
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
            style={{
              backgroundColor: CSS_VARS.secondary,
              color: CSS_VARS.secondaryForeground,
              borderColor: CSS_VARS.border,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEdit}
            style={{
              backgroundColor: CSS_VARS.primary,
              color: CSS_VARS.primaryForeground,
            }}
            className="hover:opacity-90 transition-opacity"
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}