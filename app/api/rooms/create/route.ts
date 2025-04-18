import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const { name, isPrivate } = await req.json();

     if (!name || typeof name !== 'string' || name.trim() === '') {
          return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
     }

     const roomName = name.trim();
     const userId = session.user.id;

     // Start a transaction to create room and add creator as participant
     const { data, error } = await supabase
          .from('rooms')
          .insert({ 
               name: roomName, 
               created_by: userId,
               is_private: isPrivate 
          })
          .select()
          .single();

     if (error) {
          return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
     }

     // If private room, add creator as participant
     if (isPrivate) {
          const { error: participantError } = await supabase
               .from('room_participants')
               .insert({
                    room_id: data.id,
                    user_id: userId,
                    status: 'accepted'
               });

          if (participantError) {
               return NextResponse.json({ error: 'Failed to add room participant' }, { status: 500 });
          }
     }

     return NextResponse.json(data);
}