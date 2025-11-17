// app/api/rooms/[roomid]/leave/route.ts - ULTRA-FAST
import { NextRequest, NextResponse } from "next/server";
import { withAuth, UUID_REGEX } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomid: string } }
) {
  const startTime = Date.now();
  
  return withAuth(async ({ supabase, user }) => {
    try {
      const roomId = params.roomid?.trim();

      // 🚀 ULTRA-FAST VALIDATION
      if (!roomId || !UUID_REGEX.test(roomId)) {
        return NextResponse.json({ 
          success: false,
          error: 'Invalid room ID' 
        }, { status: 400 });
      }

      console.log(`🚀 LEAVE START: ${roomId} by ${user.id}`);

      // 🚀 DIRECT RPC CALL (Now returns JSONB)
      const { data, error } = await supabase.rpc('leave_room', {
        p_room_id: roomId,
        p_user_id: user.id
      });

      const dbTime = Date.now() - startTime;
      
      if (error) {
        console.error(`❌ LEAVE RPC ERROR (${dbTime}ms):`, error.message);
        return NextResponse.json({ 
          success: false,
          error: 'Failed to leave room' 
        }, { status: 500 });
      }

      // 🚀 HANDLE RPC RESPONSE
      if (data.success === false) {
        console.log(`❌ LEAVE FAILED (${dbTime}ms):`, data.error);
        
        if (data.error === 'CREATOR_CANNOT_LEAVE') {
          return NextResponse.json({ 
            success: false,
            error: data.message 
          }, { status: 400 });
        }
        
        return NextResponse.json({ 
          success: false,
          error: data.error || 'Failed to leave room' 
        }, { status: 500 });
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ LEAVE SUCCESS: ${totalTime}ms (DB: ${dbTime}ms) - ${data.message}`);

      return NextResponse.json({ 
        success: true,
        message: data.message,
        leftRoomId: roomId,
        performance: `${totalTime}ms`
      });

    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error(`💥 LEAVE ERROR (${totalTime}ms):`, err);
      return NextResponse.json({ 
        success: false,
        error: 'Internal server error' 
      }, { status: 500 });
    }
  });
}