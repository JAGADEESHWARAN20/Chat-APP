import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
<<<<<<< HEAD
import { NextRequest, NextResponse } from "next/server";

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
=======
import { NextResponse } from "next/server";
>>>>>>> 6bd24b2ac8dc15ca5dcd1c42f14d20e12f8b9738

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rooms:", error);
      return NextResponse.json(
        { error: "Failed to fetch rooms" },
        { status: 500 }
      );
    }

<<<<<<< HEAD
    // Process the rooms data to include additional information
    const processedRooms = rooms.map(room => {
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

=======
>>>>>>> 6bd24b2ac8dc15ca5dcd1c42f14d20e12f8b9738
    return NextResponse.json({
      success: true,
      rooms
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
