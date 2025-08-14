import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export const useRoomPresence = (roomId: string | null) => {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!roomId) return;

    // Function to fetch current presence state
    const fetchPresence = async () => {
      const { data: roomMembers } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('status', 'accepted');

      setActiveUsers(roomMembers?.length || 0);
    };

    // Initial fetch
    fetchPresence();

    // Subscribe to presence changes
    const channel = supabase.channel(`room:${roomId}`)
      .on('presence', { event: 'sync' }, () => {
        fetchPresence();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, supabase]);

  return { activeUsers };
};
