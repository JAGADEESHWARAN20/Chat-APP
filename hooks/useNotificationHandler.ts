import { toast } from 'sonner';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useNotification } from '@/lib/store/notifications';
import { useEffect } from 'react';
import { useUser } from '@/lib/store/user';

export function useNotificationHandler() {
  const { user } = useUser();
  const { addNotification } = useNotification();

  useEffect(() => {
    if (!user) return;

    const supabase = supabaseBrowser();
    
    // Subscribe to notifications table
    const notificationSubscription = supabase
      .channel('notification-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new;
          
          // Add to notification store
          await addNotification(notification);

          // Determine notification type and display appropriate toast
          switch (notification.type) {
            case 'message':
              toast.info(`New message from ${notification.sender?.username || 'someone'}`, {
                description: notification.message,
                action: {
                  label: 'View',
                  onClick: () => {/* TODO: Navigate to message */}
                }
              });
              break;

            case 'room_join':
              toast.success(`${notification.sender?.username || 'Someone'} joined ${notification.room?.name || 'the room'}`, {
                description: notification.message
              });
              break;

            case 'room_leave':
              toast.info(`${notification.sender?.username || 'Someone'} left ${notification.room?.name || 'the room'}`, {
                description: notification.message
              });
              break;

            case 'ownership_transfer':
              toast.success('Room ownership transferred', {
                description: notification.message
              });
              break;
              
            default:
              toast(notification.message);
          }
        }
      )
      .subscribe();

    // Handle real-time room presence
    const presenceSubscription = supabase
      .channel('presence-channel')
      .on(
        'presence',
        { event: 'leave' },
        ({ leftPresence }) => {
          if (leftPresence?.user_id && leftPresence?.room_id) {
            toast.info(`${leftPresence.username || 'Someone'} left the chat`);
          }
        }
      )
      .subscribe();

    return () => {
      notificationSubscription.unsubscribe();
      presenceSubscription.unsubscribe();
    };
  }, [user, addNotification]);
}