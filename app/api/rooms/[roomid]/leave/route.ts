// app/api/rooms/[roomid]/leave/route.ts - OPTIMIZED
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
        return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
      }

      console.log(`🚀 LEAVE START: ${roomId} by ${user.id}`);

      // 🚀 DIRECT RPC CALL (Single operation)
      const { error } = await supabase.rpc('leave_room', {
        p_room_id: roomId,
        p_user_id: user.id
      });

      const dbTime = Date.now() - startTime;
      
      if (error) {
        console.error(`❌ LEAVE RPC ERROR (${dbTime}ms):`, error.message);
        
        // 🚀 SMART ERROR HANDLING
        if (error.message.includes('CREATOR_CANNOT_LEAVE')) {
          return NextResponse.json({ 
            error: error.message.replace('CREATOR_CANNOT_LEAVE: ', '') 
          }, { status: 400 });
        }
        
        // 🚀 Silent success for edge cases
        if (error.message.includes('ROOM_NOT_FOUND') || error.message.includes('not a member')) {
          return NextResponse.json({ success: true, message: 'Left room' });
        }

        throw error;
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ LEAVE SUCCESS: ${totalTime}ms (DB: ${dbTime}ms)`);

      return NextResponse.json({ 
        success: true,
        message: 'Left room successfully',
        performance: `${totalTime}ms`
      });

    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error(`💥 LEAVE ERROR (${totalTime}ms):`, err);
      return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
    }
  });
}