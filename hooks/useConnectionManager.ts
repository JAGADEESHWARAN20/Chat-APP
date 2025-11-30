// hooks/useConnectionManager.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/lib/store/notifications";

export function useConnectionManager(userId: string | null) {
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("disconnected");

  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const baseDelay = 1000;

  // ✅ Correct store functions
  const { subscribe, unsubscribe, retry } = useNotifications();

  const attemptReconnection = useCallback(async () => {
    if (!userId || retryCountRef.current >= maxRetries) return;

    setConnectionState("connecting");

    try {
      const delay = Math.min(
        baseDelay * Math.pow(2, retryCountRef.current),
        30000
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      retry(userId); // 🔥 correct API call

      setConnectionState("connected");
      retryCountRef.current = 0;
    } catch (err) {
      retryCountRef.current++;

      if (retryCountRef.current < maxRetries) {
        attemptReconnection();
      } else {
        setConnectionState("disconnected");
      }
    }
  }, [userId, retry]);

  useEffect(() => {
    if (!userId) return;

    // Subscribe when user logs in
    subscribe(userId);
    setConnectionState("connected");

    return () => {
      unsubscribe();
      setConnectionState("disconnected");
    };
  }, [userId, subscribe, unsubscribe]);

  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        connectionState === "disconnected"
      ) {
        attemptReconnection();
      }
    };

    const handleOnline = () => {
      if (connectionState === "disconnected") {
        attemptReconnection();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [connectionState, userId, attemptReconnection]);

  return { connectionState, attemptReconnection };
}
