// hooks/useNotificationDebug.ts - ADD THIS NEW HOOK
import { useEffect } from 'react';
import { useNotification } from '@/lib/store/notifications';

export function useNotificationDebug() {
  const { notifications, unreadCount, isLoading, hasError } = useNotification();
  
  useEffect(() => {
    console.log('🔔 Notification Debug:', {
      total: notifications.length,
      unread: unreadCount,
      isLoading,
      hasError,
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        status: n.status,
        message: n.message
      }))
    });
  }, [notifications, unreadCount, isLoading, hasError]);
}