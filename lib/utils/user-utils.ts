// lib/utils/user-utils.ts
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    
    return session?.user?.id || null;
  } catch (error) {
    console.error('Error in getCurrentUserId:', error);
    return null;
  }
}

export function getSupabaseClient() {
  return getSupabaseBrowserClient();
}