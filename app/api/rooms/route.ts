// /app/api/rooms/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     // User must be logged in to create a room
     if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const { name } = await req.json();

     if (!name || typeof name !== 'string' || name.trim() === '') {
          return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
     }

     const roomName = name.trim();
     const userId = session.user.id;

     // Optional: Check if room name already exists (consider case sensitivity)
     // const { data: existingRoom, error: checkError } = await supabase
     //   .from('rooms')
     //   .select('id')
     //   .ilike('name', roomName) // Case-insensitive check
     //   .maybeSingle();
     // if (checkError) {
     //    console.error('Error checking room:', checkError);
     //    return NextResponse.json({ error: 'Database error checking room' }, { status: 500 });
     // }
     // if (existingRoom) {
     //    return NextResponse.json({ error: 'Room name already taken' }, { status: 409 });
     // }


     // Insert the new room
     const { data, error } = await supabase
          .from('rooms')
          .insert({ name: roomName, created_by: userId }) // Include created_by
          .select() // Select the newly created room data
          .single(); // Expect only one row back

     if (error) {
          console.error('Error creating room:', error);
          // Consider more specific error handling (e.g., unique constraint violation)
          return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
     }

     return NextResponse.json(data); // Return the newly created room
}

// Optional: GET handler to fetch all rooms
export async function GET(req: NextRequest) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const { data, error } = await supabase
          .from('rooms')
          .select('*') // Select all columns
          .order('created_at', { ascending: true }); // Or order by name, etc.

     if (error) {
          console.error('Error fetching rooms:', error);
          return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
     }

     return NextResponse.json(data || []);
}