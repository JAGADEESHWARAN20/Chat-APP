import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, errorResponse, successResponse } from "@/lib/api-utils";

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  isPrivate: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { name, isPrivate } = createRoomSchema.parse(await req.json());
      const roomName = name.trim();

      const timestamp = new Date().toISOString();

      // Use RPC function for atomic room creation
      const { data: newRoomData, error: rpcError } = await supabase.rpc("create_room_with_member", {
        p_name: roomName,
        p_is_private: isPrivate,
        p_user_id: user.id,
        p_timestamp: timestamp
      });

      if (rpcError) {
        console.error('[Create Room API] RPC error:', rpcError);
        return errorResponse('Failed to create room', 'RPC_ERROR', 500);
      }

      const createdRoom = newRoomData?.[0];
      if (!createdRoom?.id) {
        return errorResponse('Failed to create room', 'CREATION_FAILED', 500);
      }

      return successResponse({
        room: {
          id: createdRoom.id,
          name: roomName,
          created_by: user.id,
          is_private: isPrivate,
          created_at: timestamp
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse("Invalid room data", "VALIDATION_ERROR", 400);
      }
      console.error('[Create Room API] Unexpected error:', error);
      return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
    }
  });
}