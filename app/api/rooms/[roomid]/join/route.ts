// app/api/rooms/[roomid]/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, UUID_REGEX } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { roomid: string } }
) {
  const startTime = Date.now();

  return withAuth(async ({ supabase }) => {
    try {
      const roomId = params.roomid?.trim();

      if (!roomId || !UUID_REGEX.test(roomId)) {
        return NextResponse.json({ success: false, error: 'Invalid room ID' }, { status: 400 });
      }

      console.log(`🚀 JOIN START: room=${roomId}`);

      const { data, error } = await supabase.rpc("join_room", {
        p_room_id: roomId     // ✅ ONLY THIS
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
        return NextResponse.json(
          { success: false, error: data.error ?? 'Failed to join' },
          { status: 400 }
        );
      }

      const total = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        action: data.action,
        status: data.status,
        room_name: data.room_name,
        performance: `${total}ms`
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 500 }
      );
    }
  });
}
