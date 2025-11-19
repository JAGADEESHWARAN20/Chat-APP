// app/api/rooms/[roomId]/join/route.ts
import { NextRequest } from "next/server";
import { withAuth, errorResponse, successResponse, validateUUID } from "@/lib/api-utils";

export const POST = async (req: NextRequest, ctx?: { params?: { roomId?: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      let roomId = ctx?.params?.roomId ?? null;
      if (!roomId) {
        const url = new URL(req.url);
        const parts = url.pathname.split("/").filter(Boolean);
        const roomsIndex = parts.findIndex((p) => p === "rooms");
        if (roomsIndex >= 0 && parts.length > roomsIndex + 1) {
          roomId = parts[roomsIndex + 1];
        }
      }
      if (!roomId) return errorResponse("Missing room id", "MISSING_ROOM_ID", 400);
      validateUUID(roomId, "roomId");

      // call join_room
      const { data, error } = await supabase.rpc("join_room", {
        p_room_id: roomId,
        p_user_id: user.id,
      });

      if (error) {
        console.error("JOIN RPC ERROR:", error);
        return errorResponse(error.message || "Failed to join room", "JOIN_FAILED", 500);
      }

      // data is jsonb returned by function
      return successResponse(data ?? { status: "unknown", room_id: roomId });
    } catch (e) {
      console.error("JOIN API ERROR:", e);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  })(req);
