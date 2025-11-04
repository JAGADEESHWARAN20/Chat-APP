// hooks/useNotificationDebug.ts
import { useEffect } from 'react';
import { useNotification } from '@/lib/store/notifications';

export function useNotificationDebug() {
  const { notifications, unreadCount, isLoading, hasError } = useNotification();
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
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
    }
  }, [notifications, unreadCount, isLoading, hasError]);
}