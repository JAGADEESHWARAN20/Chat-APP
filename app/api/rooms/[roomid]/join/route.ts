// app/api/rooms/[roomid]/join/route.ts - OPTIMIZED
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

      // 🚀 ULTRA-FAST VALIDATION
      if (!roomId || !UUID_REGEX.test(roomId)) {
        return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
      }

      console.log(`🚀 JOIN START: ${roomId} by ${user.id}`);

      // 🚀 DIRECT RPC CALL (Single operation)
      const { data, error } = await supabase.rpc('join_room', {
        p_room_id: roomId,
        p_user_id: user.id
      });

      const dbTime = Date.now() - startTime;
      
      if (error) {
        console.error(`❌ JOIN RPC ERROR (${dbTime}ms):`, error.message);
        throw error;
      }

      if (data.success === false) {
        if (data.error === 'ALREADY_MEMBER') {
          return NextResponse.json({ error: 'Already a member' }, { status: 409 });
        }
        if (data.error === 'ROOM_NOT_FOUND') {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }
        throw new Error(data.error);
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ JOIN SUCCESS: ${totalTime}ms (DB: ${dbTime}ms) - ${data.action}`);

      return NextResponse.json({
        success: true,
        action: data.action,
        room_name: data.room_name,
        status: data.status,
        performance: `${totalTime}ms`
      });

    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error(`💥 JOIN ERROR (${totalTime}ms):`, err);
      return NextResponse.json({ error: err.message || 'Failed to join room' }, { status: 500 });
    }
  });
}