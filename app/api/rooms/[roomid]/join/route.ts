import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
     req: NextRequest,
     { params }: { params: { roomId: string } }
) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const { roomId } = params;
     const userId = session.user.id;

     // Check if room exists and if it's private
     const { data: room } = await supabase
          .from('rooms')
          .select('is_private, created_by')
          .eq('id', roomId)
          .single();

     if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 });
     }

     // For private rooms, create pending request
     const status = room.is_private ? 'pending' : 'accepted';

     const { error } = await supabase
          .from('room_members')
          .insert({
               room_id: roomId,
               user_id: userId,
               status
          });

     if (error) {
          return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
     }

     return NextResponse.json({ status });
}