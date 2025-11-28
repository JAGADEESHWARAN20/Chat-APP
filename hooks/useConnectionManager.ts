// hooks/useConnectionManager.ts - NEW
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotification } from '@/lib/store/notifications';

export function useConnectionManager(userId: string | null) {
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const baseDelay = 1000;
  
  const { subscribeToNotifications, unsubscribeFromNotifications, retrySubscription } = useNotification();

  const attemptReconnection = useCallback(async () => {
    if (!userId || retryCountRef.current >= maxRetries) return;

    setConnectionState('connecting');
    
    try {
      await new Promise((resolve) => {
        const delay = baseDelay * Math.pow(2, retryCountRef.current);
        setTimeout(resolve, Math.min(delay, 30000)); // Max 30s delay
      });

      retrySubscription(userId);
      setConnectionState('connected');
      retryCountRef.current = 0;
    } catch (error) {
      retryCountRef.current++;
      if (retryCountRef.current < maxRetries) {
        attemptReconnection();
      } else {
        setConnectionState('disconnected');
      }
    }
  }, [userId, retrySubscription]);

  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && connectionState === 'disconnected') {
        attemptReconnection();
      }
    };

    const handleOnline = () => {
      if (connectionState === 'disconnected') {
        attemptReconnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, connectionState, attemptReconnection]);

  return { connectionState, attemptReconnection };
}