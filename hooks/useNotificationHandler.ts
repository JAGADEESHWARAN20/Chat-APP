// hooks/useNotificationHandler.ts
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useNotification } from '@/lib/store/notifications';
import { useEffect, useRef } from 'react';
import { useUser } from '@/lib/store/user';

interface RawNotification {
  id: string;
  message: string;
  created_at: string;
  status: string;
  type: string;
  sender_id: string | null;
  user_id: string;
  room_id: string | null;
  join_status: string | null;
  direct_chat_id: string | null;
  sender?: any;
  recipient?: any;
  room?: any;
}

export function useNotificationHandler() {
  const { user: currentUser, authUser } = useUser();
  const { addNotification } = useNotification();
  const mountedRef = useRef(true);

  const userId = currentUser?.id || authUser?.id;

  useEffect(() => {
    mountedRef.current = true;

    if (!userId) {
      console.log("❌ No user ID for notification handler");
      return;
    }

    console.log("🔔 Setting up notification handler for user:", userId);

    const supabase = getSupabaseBrowserClient();
    
    // Subscribe to notifications table
    const notificationSubscription = supabase
      .channel('notification-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (!mountedRef.current) return;

          try {
            const rawNotification = payload.new as RawNotification;
            
            // Transform the raw notification
            const notification = {
              id: rawNotification.id,
              message: rawNotification.message,
              created_at: rawNotification.created_at,
              status: rawNotification.status,
              type: rawNotification.type,
              sender_id: rawNotification.sender_id,
              user_id: rawNotification.user_id,
              room_id: rawNotification.room_id,
              join_status: rawNotification.join_status,
              direct_chat_id: rawNotification.direct_chat_id,
              users: rawNotification.sender || null,
              recipient: rawNotification.recipient || null,
              rooms: rawNotification.room || null,
            };
            
            // Add to notification store
            await addNotification(notification);

            // Show toast based on notification type
            switch (notification.type) {
              case 'message':
                toast.info(`New message from ${notification.users?.username || 'someone'}`, {
                  description: notification.message,
                  duration: 4000,
                });
                break;

              case 'room_join':
                toast.success(`${notification.users?.username || 'Someone'} joined the room`, {
                  description: notification.message,
                  duration: 3000,
                });
                break;

              case 'room_leave':
                toast.info(`${notification.users?.username || 'Someone'} left the room`, {
                  description: notification.message,
                  duration: 3000,
                });
                break;

              case 'join_request':
                toast.info('New join request', {
                  description: notification.message,
                  duration: 5000,
                  action: {
                    label: 'View',
                    onClick: () => {
                      // TODO: Navigate to notifications
                    }
                  }
                });
                break;

              case 'ownership_transfer':
                toast.success('Room ownership transferred', {
                  description: notification.message,
                  duration: 4000,
                });
                break;
                
              default:
                toast(notification.message, { duration: 3000 });
            }
          } catch (error) {
            console.error('Error handling notification:', error);
          }
        }
      )
      .subscribe((status) => {
        if (mountedRef.current) {
          console.log(`🔔 Notification subscription: ${status}`);
        }
      });

    return () => {
      mountedRef.current = false;
      notificationSubscription.unsubscribe();
    };
  }, [userId, addNotification]);
}