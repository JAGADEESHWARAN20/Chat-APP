import { NextRequest } from "next/server";
import {
  withAuth,
  validateUUID,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

export const PATCH = (req: NextRequest, ctx: { params: { roomId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    let actualRoomId = ctx.params.roomId;

    try {
      validateUUID(actualRoomId, "roomId");

      // Fetch room
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, name, created_by")
        .eq("id", actualRoomId)
        .single();

      if (roomError || !room) {
        return errorResponse("Room not found", "ROOM_NOT_FOUND", 404);
      }

      // Must be member
      const { data: member } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", actualRoomId)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .single();

      if (!member) {
        return errorResponse("Not a member of this room", "NOT_A_MEMBER", 403);
      }

      /* -----------------------------------------
         CREATOR LEAVING (Deleting room)
      ----------------------------------------- */
      if (room.created_by === user.id) {
        const { count } = await supabase
          .from("room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", actualRoomId)
          .eq("status", "accepted");

        if (count && count > 1) {
          return errorResponse(
            "Creator must transfer ownership before leaving",
            "CREATOR_CANNOT_LEAVE",
            400
          );
        }

        // Delete room (now safe with CASCADE)
        const { error: deleteError } = await supabase
          .from("rooms")
          .delete()
          .eq("id", actualRoomId);

        if (deleteError) {
          return errorResponse(deleteError.message, "DELETE_ERROR", 500);
        }

        return successResponse({ deleted: true });
      }

      /* -----------------------------------------
         MEMBER LEAVING — RPC
      ----------------------------------------- */
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "remove_from_room",
        {
          p_room_id: actualRoomId,
          p_user_id: user.id,
        }
      );

      if (rpcError) {
        return errorResponse(rpcError.message, "LEAVE_FAILED", 500);
      }

      return successResponse({ success: true });
    } catch (error: any) {
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  })(req); // ✔ ONLY pass req
