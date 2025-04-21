import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomId } = params;
  const userId = session.user.id;

  // Validate roomId
  if (!roomId || roomId === 'undefined') {
    console.error('Missing or invalid roomId:', roomId);
    return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
  }

  // Log accessible rooms for debugging
  const { data: allRooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, name');
  if (roomsError) {
    console.error('Error fetching rooms:', roomsError.message);
  } else {
    console.log('All accessible rooms:', allRooms);
  }

  const requestBody = await req.json();
  const { status, joined_at } = requestBody;
  console.log('Received request:', { roomId, userId, requestBody });

  // Check if room exists
  const { data: roomExists, error: roomError } = await supabase
    .from('rooms')
    .select('id')
    .eq('id', roomId)
    .single();

  if (roomError || !roomExists) {
    console.error('Room lookup failed:', { roomId, error: roomError?.message });
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  // Insert participant
  const { error: insertError } = await supabase
    .from('room_participants')
    .insert({
      room_id: roomId,
      user_id: userId,
      status,
      joined_at: joined_at || new Date().toISOString(),
    });

  if (insertError) {
    console.error('Insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }

  console.log('Successfully joined room:', { roomId, userId, status });
  return NextResponse.json({ success: true, message: 'Joined room successfully' });
}