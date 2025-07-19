// api/rooms/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from "@/lib/types/supabase"; // Import Database type

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies }); // Use Database type
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) { // Check for sessionError as well
    console.error("[Create Room API] Authentication error:", sessionError?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, isPrivate } = await req.json();

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
  }

  const roomName = name.trim();
  const userId = session.user.id;
  const timestamp = new Date().toISOString(); // Get current timestamp for RPC

  try {
    // Use the Supabase RPC function to create the room and add the creator as a member/participant.
    // This RPC (create_room_with_member) is expected to handle:
    // 1. Inserting the room into the 'rooms' table.
    // 2. Inserting the creator into 'room_participants' with 'accepted' status.
    // 3. Inserting the creator into 'room_members' with 'accepted' status and 'active: true'.
    // 4. Deactivating any other active rooms for this user in 'room_members'.
    const { data: newRoomData, error: rpcError } = await supabase.rpc("create_room_with_member", {
      p_name: roomName,
      p_is_private: isPrivate,
      p_user_id: userId,
      p_timestamp: timestamp // Pass the timestamp to the RPC
    });

    if (rpcError) {
      console.error('[Create Room API] RPC error:', rpcError);
      return NextResponse.json({ error: 'Failed to create room via RPC', details: rpcError.message }, { status: 500 });
    }

    // The RPC returns an array of objects with 'id'. We expect one room.
    const createdRoom = newRoomData?.[0];

    if (!createdRoom || !createdRoom.id) {
        console.error('[Create Room API] RPC did not return expected room data:', newRoomData);
        return NextResponse.json({ error: 'Failed to retrieve created room ID from RPC' }, { status: 500 });
    }

    // Optionally, send a notification to the creator that the room was created.
    // This notification is marked as 'read' as the user just performed the action.
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: "room_created",
        room_id: createdRoom.id,
        sender_id: userId,
        message: `You created the room "${roomName}"`,
        status: "read", // Mark as read since the user just created it
      });

    if (notifError) {
      console.warn("[Create Room API] Notification error (non-blocking, but log for debugging):", notifError.message);
    }

    // Return the created room data to the client.
    return NextResponse.json({
        id: createdRoom.id,
        name: roomName,
        created_by: userId,
        is_private: isPrivate,
        created_at: timestamp // Assuming RPC uses this timestamp or sets its own
    });

  } catch (err) {
    console.error('[Create Room API] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error', details: (err as Error).message }, { status: 500 });
  }
}
