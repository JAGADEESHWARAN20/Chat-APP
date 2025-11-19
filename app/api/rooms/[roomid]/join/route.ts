import { NextRequest } from "next/server";
import { withAuth, errorResponse, successResponse, validateUUID } from "@/lib/api-utils";

export const POST = (req: NextRequest, ctx: { params: { roomId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const roomId = ctx.params.roomId; // ← FIXED PARAMS
      if (!roomId) {
        return errorResponse("Missing room id", "MISSING_ROOM_ID", 400);
      }

      validateUUID(roomId, "roomId");

      // Call your join RPC
      const { data, error } = await supabase.rpc("join_room", {
        p_room_id: roomId,
        p_user_id: user.id,
      });

      if (error) {
        console.error("JOIN RPC ERROR:", error);
        return errorResponse("Failed to join room", "JOIN_FAILED", 500);
      }

      return successResponse(data);
    } catch (e) {
      console.error("JOIN API ERROR:", e);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  })(req);
