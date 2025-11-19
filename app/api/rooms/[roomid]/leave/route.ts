// app/api/rooms/[roomId]/leave/route.ts
import { NextRequest } from "next/server";
import {
  withAuth,
  validateUUID,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

export const PATCH = async (req: NextRequest, ctx?: { params?: { roomId?: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      // Resolve roomId (App Router preferred; fallback to URL parse)
      let roomId = ctx?.params?.roomId ?? null;
      if (!roomId) {
        try {
          const url = new URL(req.url);
          const parts = url.pathname.split("/").filter(Boolean);
          const idx = parts.findIndex((p) => p === "rooms");
          if (idx >= 0 && parts.length > idx + 1) roomId = parts[idx + 1];
        } catch (e) {
          roomId = null;
        }
      }

      if (!roomId) {
        console.error("[leave] missing roomId - url:", req.url);
        return errorResponse("Missing room id", "MISSING_ROOM_ID", 400);
      }

      // validate uuid - will throw if invalid
      try {
        validateUUID(roomId, "roomId");
      } catch (ve) {
        console.error("[leave] validateUUID failed:", ve);
        return errorResponse("Invalid room id", "INVALID_ROOM_ID", 400);
      }

      // Call RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc("remove_from_room", {
        p_room_id: roomId,
      });

      // Log everything useful for debugging (server console)
      console.info("[leave] user:", user?.id, "roomId:", roomId);
      console.info("[leave] rpcError:", rpcError);
      console.info("[leave] rpcData:", JSON.stringify(rpcData));

      // If PostgREST returned a PostgREST error object:
      if (rpcError) {
        // include rpcError.message in response so front-end can show it while debugging
        return errorResponse(rpcError.message || "RPC error", "LEAVE_FAILED", 400);
      }

      // Normalize RPC result
      const result =
        rpcData && typeof rpcData === "object" && "success" in rpcData
          ? rpcData
          : Array.isArray(rpcData) && rpcData.length > 0
          ? rpcData[0]
          : rpcData;

      if (!result) {
        console.error("[leave] invalid rpc result:", rpcData);
        return errorResponse("Invalid RPC result", "INVALID_RPC_RESULT", 500);
      }

      // If the RPC itself set success:false -> return its message to client
      if (result.success === false) {
        const code = result.error ?? "LEAVE_FAILED";
        const msg = result.message ?? "Failed to leave room";
        return errorResponse(msg, code, 400);
      }

      // Success — return the full result so client knows action/message
      return successResponse(result);
    } catch (err: any) {
      console.error("[leave] unexpected error:", err);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  })(req);
