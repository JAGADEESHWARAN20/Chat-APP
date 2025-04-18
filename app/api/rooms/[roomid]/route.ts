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

     const roomId = params.roomId;
     const userId = session.user.id;

     // Check if room exists and is private
     const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();

     if (roomError || !room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 });
     }

     // If room is private, create a join request
     if (room.is_private) {
          const { error: participantError } = await supabase
               .from('room_participants')
               .insert({
                    room_id: roomId,
                    user_id: userId,
                    status: 'pending'
               });

          if (participantError) {
               return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 });
          }

          return NextResponse.json({ status: 'pending' });
     }

     // If room is public, directly add user as member
     const { error: memberError } = await supabase
          .from('room_participants')
          .insert({
               room_id: roomId,
               user_id: userId,
               status: 'accepted'
          });

     if (memberError) {
          return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
     }

     return NextResponse.json({ status: 'accepted' });
}