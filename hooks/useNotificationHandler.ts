// hooks/useNotificationHandler.ts (integrate logic into unified store; this hook can now be simplified or removed if not used elsewhere)
"use client";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// Note: Since we've consolidated notification handling into unified-roomstore,
// this hook's realtime subscription should be removed to avoid duplication.
// Retain only if needed for other logic; otherwise, remove the file.
export function useNotificationHandler() {
  const userId = useUnifiedStore((s) => s.userId);
  const mounted = useRef(true);
  // No separate subscribe/unsubscribe needed anymore; unified handles it.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // handleNotification can be called manually if needed elsewhere, but primary logic is now in store.
  const handleNotification = useCallback(async (notif: any) => {
    if (!mounted.current || !userId) return;
    // Toast logic moved to store; this is fallback if needed.
    switch (notif.type) {
      case "join_request_accepted": {
        toast.success("Your request to join a room was accepted!", {
          description: notif.message ?? "",
        });
        break;
      }
      case "join_request_rejected":
        toast.error("Your join request was rejected.");
        break;
      case "room_invite":
        toast.info("You were invited to a room.");
        break;
      case "message":
        toast.info(
          `New message from ${notif.users?.username || notif.users?.display_name || "someone"}`,
          { description: notif.message }
        );
        break;
      default:
        toast(notif.message ?? "New notification");
    }
  }, [userId]);
  return { handleNotification };
}