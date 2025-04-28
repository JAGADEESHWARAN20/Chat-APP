import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const roomId = params.roomId;

  try {
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // First check if the user is a member of the room
    const { data: membership, error: membershipError } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 404 }
      );
    }

    // Remove user from room_members
    const { error: deleteError } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error removing user from room:', deleteError);
      return NextResponse.json(
        { error: "Failed to leave room" },
        { status: 500 }
      );
    }

    // Remove any pending room_participants entries
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', session.user.id);

    // Update active room if this was the active room
    if (membership.active) {
      // Find another room to make active
      const { data: otherRoom } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', session.user.id)
        .neq('room_id', roomId)
        .limit(1)
        .single();

      if (otherRoom) {
        await supabase
          .from('room_members')
          .update({ active: true })
          .eq('room_id', otherRoom.room_id)
          .eq('user_id', session.user.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Successfully left the room"
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
