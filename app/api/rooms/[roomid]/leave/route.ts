import { NextRequest } from "next/server";
import { withAuth, validateUUID, errorResponse, successResponse } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId?: string; roomid?: string }> }
) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { roomId, roomid } = await params;
      const actualRoomId = roomId ?? roomid;

      if (!actualRoomId) {
        return errorResponse("Room ID is required", "MISSING_ROOM_ID", 400);
      }
      validateUUID(actualRoomId, "roomId");

      // Get room details
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, name, created_by")
        .eq("id", actualRoomId)
        .single();

      if (roomError || !room) {
        return errorResponse("Room not found", "ROOM_NOT_FOUND", 404);
      }

      // Check if user is a member
      const { data: member } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", actualRoomId)
        .eq("user_id", user.id)
        .single();

      if (!member) {
        return errorResponse("Not a member of this room", "NOT_A_MEMBER", 403);
      }

      // Check if creator is trying to leave
      if (room.created_by === user.id) {
        const { count } = await supabase
          .from("room_members")
          .select("user_id", { count: "exact" })
          .eq("room_id", actualRoomId)
          .eq("status", "accepted");

        if (count && count > 1) {
          return errorResponse("Creator must transfer ownership before leaving", "CREATOR_CANNOT_LEAVE", 400);
        }
        // If only member, delete the room
        await supabase.from("rooms").delete().eq("id", actualRoomId);
      } else {
        // Use RPC to leave room
        const { error: leaveError } = await supabase.rpc("leave_room", {
          p_room_id: actualRoomId,
          p_user_id: user.id
        });

        if (leaveError) {
          throw leaveError;
        }
      }

      // Get user's remaining rooms
      const { data: otherRooms } = await supabase
        .from("room_members")
        .select("room_id, rooms(name)")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      return successResponse({
        message: `Successfully left "${room.name}"`,
        roomLeft: { id: room.id, name: room.name },
        hasOtherRooms: !!otherRooms?.length,
        defaultRoom: otherRooms?.[0] ? {
          id: otherRooms[0].room_id,
          name: otherRooms[0].rooms.name
        } : null
      });
    } catch (error) {
      console.error("[Leave Room] Error:", error);
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  });
}

// Add other HTTP methods for completeness
export async function GET() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function POST() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function PUT() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function DELETE() {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}