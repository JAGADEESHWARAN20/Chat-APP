// hooks/useConnectionManager.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUnifiedRealtime, useUnifiedStore } from "@/lib/store/unified-roomstore";

type ConnState = "connected" | "connecting" | "disconnected";

export function useConnectionManager(userId: string | null) {
  const [connectionState, setConnectionState] = useState<ConnState>("disconnected");

  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const baseDelay = 1000; // ms

  // Ensure the unified realtime hook runs (it internally subscribes/unsubscribes)
  // NOTE: this is a hook from the unified-roomstore that uses useEffect internally
  useUnifiedRealtime(userId);

  // Use the store's functions directly without subscribing to the store
  const store = useUnifiedStore.getState();

  // attempt reconnect: call fetchAll + fetchNotifications as repair steps
  const attemptReconnection = useCallback(async () => {
    if (!userId) return;
    // already trying / connected guard
    if (connectionState === "connecting") return;

    setConnectionState("connecting");
    try {
      const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), 30_000);
      // small delay before retry to avoid thundering re-connects
      await new Promise((res) => setTimeout(res, delay));

      // make sure store knows current user
      store.setUserId(userId);

      // Attempt to re-sync important data via store APIs
      // fetchAll refreshes rooms, users and notifications
      await store.fetchAll?.();

      // ensure notifications are fresh
      await store.fetchNotifications?.();

      // success -> reset retry count and mark connected
      retryCountRef.current = 0;
      setConnectionState("connected");
    } catch (err) {
      // failed -> increment retries & schedule next attempt (if allowed)
      retryCountRef.current = Math.min(retryCountRef.current + 1, maxRetries);
      if (retryCountRef.current < maxRetries) {
        // exponential backoff retry
        setConnectionState("disconnected");
        // schedule next attempt (do not await)
        const nextDelay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), 30_000);
        setTimeout(() => {
          attemptReconnection();
        }, nextDelay);
      } else {
        setConnectionState("disconnected");
      }
    }
  }, [userId, connectionState, store]);

  // subscribe/unsubscribe lifecycle: set userId and fetch initial data
  useEffect(() => {
    if (!userId) {
      // cleanup / user logged out
      setConnectionState("disconnected");
      // clear userId in store
      try {
        useUnifiedStore.getState().setUserId(null);
      } catch { /* ignore */ }
      return;
    }

    // set store user id and try initial fetch
    store.setUserId(userId);

    let mounted = true;
    (async () => {
      try {
        setConnectionState("connecting");
        // initial sync
        await store.fetchAll?.();
        if (!mounted) return;
        setConnectionState("connected");
      } catch (err) {
        console.error("initial fetchAll failed, will attempt reconnection", err);
        setConnectionState("disconnected");
        // schedule reconnection
        attemptReconnection();
      }
    })();

    return () => {
      mounted = false;
      // nothing else to cleanup here; unified realtime hook handles channel cleanup
      setConnectionState("disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // intentionally only run when userId changes

  // visibility / network handlers -> try reconnect when app becomes visible or online
  useEffect(() => {
    if (!userId) return;

    const onVisibility = () => {
      if (document.visibilityState === "visible" && connectionState === "disconnected") {
        attemptReconnection();
      }
    };

    const onOnline = () => {
      if (connectionState === "disconnected") {
        attemptReconnection();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, connectionState, attemptReconnection]);

  // expose a manual retry function (resets retry counter and tries)
  const manualRetry = useCallback(() => {
    retryCountRef.current = 0;
    attemptReconnection();
  }, [attemptReconnection]);

  return {
    connectionState,
    attemptReconnection: manualRetry,
  };
}
