// hooks/useTypingStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@/lib/store/RoomContext'; // Use RoomContext instead of useUser
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Database } from '@/lib/types/supabase'; // Correct path based on your imports

type TypingStatus = Database['public']['Tables']['typing_status']['Row'];
type TypingUser = TypingStatus & {
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export const useTypingStatus = (roomId: string) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { state } = useRoomContext(); // Get user from RoomContext
  const user = state.user; // Extract user from state

  // Update typing status
  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!user?.id || !roomId) return;

    const supabase = supabaseBrowser();
    
    await supabase
      .from('typing_status')
      .upsert({
        user_id: user.id,
        room_id: roomId,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      })
      .select();
  }, [user?.id, roomId]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    updateTypingStatus(true);
  }, [updateTypingStatus]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    updateTypingStatus(false);
  }, [updateTypingStatus]);

  // Load initial typing users
  const loadTypingUsers = useCallback(async () => {
    if (!roomId) return;

    const supabase = supabaseBrowser();
    
    // Use the function from your database
    const { data, error } = await supabase
      .rpc('get_typing_users', { 
        p_room_id: roomId,
        p_stale_threshold: '3 seconds'
      });

    if (error) {
      console.error('Error loading typing users:', error);
      return;
    }

    if (data) {
      setTypingUsers(data as TypingUser[]);
    }
  }, [roomId]);

  // Subscribe to typing status changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = supabaseBrowser();
    
    // Load initial data
    loadTypingUsers();

    const subscription = supabase
      .channel(`typing:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newTypingStatus = payload.new as TypingStatus;
            
            // Fetch user profile information
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('id', newTypingStatus.user_id)
              .single();

            const typingUser: TypingUser = {
              ...newTypingStatus,
              profiles: profile || undefined
            };

            setTypingUsers(prev => {
              // Remove user if they exist
              const filtered = prev.filter(u => u.user_id !== typingUser.user_id);
              
              // Add if they're typing
              if (typingUser.is_typing) {
                return [...filtered, typingUser];
              }
              
              return filtered;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedTypingStatus = payload.old as TypingStatus;
            setTypingUsers(prev => 
              prev.filter(u => u.user_id !== deletedTypingStatus.user_id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId, user?.id, loadTypingUsers]);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 3000; // 3 seconds

      setTypingUsers(prev => 
        prev.filter(typingUser => {
          if (!typingUser.updated_at) return false;
          const lastUpdated = new Date(typingUser.updated_at).getTime();
          return now.getTime() - lastUpdated < staleThreshold;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Get currently typing users (excluding current user)
  const getTypingUsers = useCallback(() => {
    return typingUsers.filter(typingUser => 
      typingUser.user_id !== user?.id && 
      typingUser.is_typing === true
    );
  }, [typingUsers, user?.id]);

  // Get typing display text
  const getTypingDisplayText = useCallback(() => {
    const users = getTypingUsers();
    
    if (users.length === 0) return '';
    
    const names = users.map(user => 
      user.profiles?.display_name || user.profiles?.username || 'Someone'
    );

    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing...`;
    }
  }, [getTypingUsers]);

  const currentTypingUsers = getTypingUsers();
  const typingDisplayText = getTypingDisplayText();

  return {
    typingUsers: currentTypingUsers,
    typingDisplayText,
    isTyping: currentTypingUsers.length > 0,
    startTyping,
    stopTyping,
    updateTypingStatus,
  };
};

// Debounced typing hook for input fields
export const useDebouncedTyping = (roomId: string, delay: number = 1000) => {
  const { startTyping, stopTyping } = useTypingStatus(roomId);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleTyping = useCallback(() => {
    // Start typing immediately
    startTyping();

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set new timeout to stop typing
    const timeout = setTimeout(() => {
      stopTyping();
    }, delay);

    setTypingTimeout(timeout);
  }, [startTyping, stopTyping, delay, typingTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        stopTyping();
      }
    };
  }, [typingTimeout, stopTyping]);

  return {
    handleTyping
  };
};