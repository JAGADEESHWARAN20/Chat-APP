import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export const useActiveUsers = (roomId: string | null) => {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!roomId) return;

    // Function to fetch current active users
    const fetchActiveUsers = async () => {
      const { data: roomMembers } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('status', 'accepted');

      const { data: presenceData } = await supabase
        .from('typing_status')
        .select('user_id')
        .eq('room_id', roomId)
        .in('user_id', roomMembers?.map(member => member.user_id) || []);

      // Count unique active users
      const uniqueActiveUsers = new Set(presenceData?.map(p => p.user_id));
      setActiveUsers(uniqueActiveUsers.size);
    };

    // Initial fetch
    fetchActiveUsers();

    // Subscribe to typing_status changes
    const channel = supabase
      .channel(`room-presence-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_status',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchActiveUsers();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, supabase]);

  return activeUsers;
};
