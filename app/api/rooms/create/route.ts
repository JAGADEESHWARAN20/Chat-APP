// app/api/rooms/create/route.ts
import { NextRequest } from "next/server";
import {
  withAuth,
  successResponse,
  errorResponse,
  withRateLimit,
} from "@/lib/api-utils";

export const POST = (req: NextRequest) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { name, isPrivate } = await req.json();

      // Rate limit
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await withRateLimit(`create-room-${ip}`);

      // Validate room name
      if (!name || typeof name !== "string" || name.trim() === "") {
        return errorResponse("Room name is required", "INVALID_NAME", 400);
      }

      const roomName = name.trim();

      if (roomName.length > 50) {
        return errorResponse(
          "Room name too long (max 50 characters)",
          "NAME_TOO_LONG",
          400
        );
      }

      const userId = user.id;
      const timestamp = new Date().toISOString();

      // Call RPC to create room + membership
      const { data: newRoomData, error: rpcError } = await supabase.rpc(
        "create_room_with_member",
        {
          p_name: roomName,
          p_is_private: isPrivate,
          p_user_id: userId,
          p_timestamp: timestamp,
        }
      );

      if (rpcError) {
        console.error("[Create Room API] RPC error:", rpcError);
        return errorResponse("Failed to create room", "CREATION_FAILED", 500);
      }

      const createdRoom = newRoomData?.[0];

      if (!createdRoom?.id) {
        return errorResponse(
          "Failed to retrieve created room",
          "ROOM_RETRIEVAL_FAILED",
          500
        );
      }

      // Non-blocking notification insertion
      supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: "room_created",
          room_id: createdRoom.id,
          sender_id: userId,
          message: `You created the room "${roomName}"`,
          status: "read",
        })
        .catch((err:string) =>
          console.warn("[Create Room API] Notification error:", err)
        );

      return successResponse(
        {
          room: {
            id: createdRoom.id,
            name: roomName,
            created_by: userId,
            is_private: isPrivate,
            created_at: timestamp,
          },
        },
        201
      );
    } catch (error) {
      console.error("[Create Room API] Unexpected error:", error);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  })(req);
