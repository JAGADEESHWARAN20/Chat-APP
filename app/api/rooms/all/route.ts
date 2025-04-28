// app/api/rooms/all/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
// Add this interface at the top of the file after the imports
interface RoomParticipant {
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
}


export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Fetch all rooms with additional information
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        *,
        room_participants!inner (
          user_id,
          status
        ),
        messages (
          count
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching rooms:", error);
      return NextResponse.json(
        { error: "Failed to fetch rooms" },
        { status: 500 }
      );
    }

    // Process the rooms data to include additional information
    const processedRooms = rooms.map(room => {
     // Then modify the participants line to include the type
      const participants: RoomParticipant[] = room.room_participants || [];
      const messageCount = room.messages?.[0]?.count || 0;
      const isUserMember = participants.some(
        (participant: RoomParticipant) => 
          participant.user_id === session.user.id && 
          participant.status === 'accepted'
      );

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        created_at: room.created_at,
        participant_count: participants.length,
        message_count: messageCount,
        is_member: isUserMember
      };
    });

    return NextResponse.json({
      success: true,
      data: processedRooms
    });

  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
