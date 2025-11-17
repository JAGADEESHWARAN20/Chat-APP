// app/api/rooms/[roomid]/leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, UUID_REGEX } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomid: string } }
) {
  const startTime = Date.now();

  return withAuth(async ({ supabase }) => {
    try {
      const roomId = params.roomid?.trim();

      if (!roomId || !UUID_REGEX.test(roomId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid room ID' },
          { status: 400 }
        );
      }

      console.log(`🚀 LEAVE START: room=${roomId}`);

      const { data, error } = await supabase.rpc("leave_room", {
        p_room_id: roomId      // ✅ ONLY THIS
      });

      const dbTime = Date.now() - startTime;

      if (error) {
        console.error(`❌ RPC ERROR (${dbTime}ms):`, error.message);
        return NextResponse.json({
          success: false,
          error: 'Failed to leave room'
        }, { status: 500 });
      }

      if (!data?.success) {
        console.warn("❌ LEAVE FAILED:", data.error);

        return NextResponse.json({
          success: false,
          error: data.message ?? data.error
        }, { status: 400 });
      }

      const total = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: data.message,
        leftRoomId: roomId,
        performance: `${total}ms`
      });

    } catch (err: any) {
      return NextResponse.json({
        success: false,
        error: 'Internal server error'
      }, { status: 500 });
    }
  });
}
