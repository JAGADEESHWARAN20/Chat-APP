import { toast } from 'sonner';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useNotification } from '@/lib/store/notifications';
import { useEffect } from 'react';
import { useUser } from '@/lib/store/user';

export function useNotificationHandler() {
  const { user } = useUser();
  const { addNotification } = useNotification();

  useEffect(() => {
    if (!user) {
      console.log("❌ No user in notification handler");
      return;
    }

    console.log("🔔 Setting up notification handler for user:", {
      id: user.id,
      email: user.email
    });

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
          const rawNotification = payload.new;
          
          // Transform the raw notification to match Inotification interface
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

          // Determine notification type and display appropriate toast
          switch (notification.type) {
            case 'message':
              toast.info(`New message from ${notification.users?.username || 'someone'}`, {
                description: notification.message,
                action: {
                  label: 'View',
                  onClick: () => {/* TODO: Navigate to message */}
                }
              });
              break;

            case 'room_join':
              toast.success(`${notification.users?.username || 'Someone'} joined ${notification.rooms?.name || 'the room'}`, {
                description: notification.message
              });
              break;

            case 'room_leave':
              toast.info(`${notification.users?.username || 'Someone'} left ${notification.rooms?.name || 'the room'}`, {
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
        (payload) => {
          // According to Supabase types, the payload for 'leave' is RealtimePresenceLeavePayload
          // which has a 'leftPresences' array, not 'leftPresence'
          const leftPresences = (payload as { leftPresences?: any[] }).leftPresences;
          if (Array.isArray(leftPresences)) {
            leftPresences.forEach((user) => {
              if (user?.user_id && user?.room_id) {
                toast.info(`${user.username || 'Someone'} left the chat`);
              }
            });
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