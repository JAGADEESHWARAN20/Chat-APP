// app/api/rooms/[roomid]/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, UUID_REGEX } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { roomid: string } }
) {
  const startTime = Date.now();

  return withAuth(async ({ supabase, user }) => {
    try {
      const roomId = params.roomid?.trim();

      // ⚡ Validate
      if (!roomId || !UUID_REGEX.test(roomId)) {
        return NextResponse.json({ success: false, error: 'Invalid room ID' }, { status: 400 });
      }

      console.log(`🚀 JOIN START: room=${roomId} user=${user.id}`);

      // ⚡ DIRECT RPC CALL (auth.uid() is used inside)
      const { data, error } = await supabase.rpc('join_room', {
        p_room_id: roomId
      });

      const dbTime = Date.now() - startTime;

      if (error) {
        console.error(`❌ JOIN RPC ERROR (${dbTime}ms):`, error.message);
        return NextResponse.json(
          { success: false, error: 'Failed to join room' },
          { status: 500 }
        );
      }

      if (!data?.success) {
        console.log(`❌ JOIN FAILED (${dbTime}ms):`, data.error);

        if (data.error === 'ALREADY_MEMBER') {
          return NextResponse.json(
            { success: false, error: 'Already a member' },
            { status: 409 }
          );
        }

        if (data.error === 'ROOM_NOT_FOUND') {
          return NextResponse.json(
            { success: false, error: 'Room not found' },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { success: false, error: data.error || 'Failed to join room' },
          { status: 500 }
        );
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ JOIN SUCCESS: ${totalTime}ms (DB ${dbTime}ms) — ${data.action}`);

      return NextResponse.json({
        success: true,
        action: data.action,
        status: data.status,
        room_name: data.room_name,
        performance: `${totalTime}ms`
      });
    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error(`💥 JOIN ERROR (${totalTime}ms):`, err);
      return NextResponse.json(
        { success: false, error: err.message || 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
