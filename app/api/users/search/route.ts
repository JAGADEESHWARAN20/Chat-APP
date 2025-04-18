import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const query = req.nextUrl.searchParams.get('query');

     if (!query) {
          return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
     }

     const { data, error } = await supabase
          .from('users')
          .select('id, username, avatar_url, display_name')
          .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
          .neq('id', session.user.id)
          .limit(10);

     if (error) {
          return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
     }

     return NextResponse.json(data);
}