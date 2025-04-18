import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     // Check if user is authenticated
     if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     // Get query parameters
     const query = req.nextUrl.searchParams.get('query');
     const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10);
     const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

     // Validate query
     if (!query || typeof query !== 'string' || query.trim() === '') {
          return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
     }

     // Validate pagination parameters
     if (isNaN(limit) || limit < 1 || limit > 50) {
          return NextResponse.json({ error: 'Invalid limit parameter (must be 1-50)' }, { status: 400 });
     }
     if (isNaN(offset) || offset < 0) {
          return NextResponse.json({ error: 'Invalid offset parameter (must be non-negative)' }, { status: 400 });
     }

     const trimmedQuery = query.trim();

     try {
          // Fetch public rooms matching the query
          const { data, error, count } = await supabase
               .from('rooms')
               .select('id, name, is_private, created_by, created_at', { count: 'exact' })
               .ilike('name', `%${trimmedQuery}%`)
               .eq('is_private', false)
               .order('created_at', { ascending: false })
               .range(offset, offset + limit - 1);

          if (error) {
               return NextResponse.json({ error: 'Failed to search rooms' }, { status: 500 });
          }

          // Return results with pagination metadata
          return NextResponse.json({
               rooms: data || [],
               total: count || 0,
               limit,
               offset,
          });
     } catch (err) {
          console.error('Error in room search:', err);
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
     }
}