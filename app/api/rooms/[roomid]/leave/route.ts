import { NextRequest, NextResponse } from "next/server";
import { withAuth, validateUUID, errorResponse, successResponse } from "@/lib/api-utils";
import { supabaseServer } from "@/lib/supabase/server"; // ← Server client (not used directly; passed via withAuth)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId?: string; roomid?: string }> }
) {
  return withAuth(async ({ supabase, user }) => {
    let actualRoomId: string | undefined; // ← Declare outside try for catch access
    try {
      const { roomId, roomid } = await params;
      actualRoomId = roomId ?? roomid;

      // Security: Sanitize & validate early
      if (!actualRoomId) {
        return errorResponse("Room ID is required", "MISSING_ROOM_ID", 400);
      }
      validateUUID(actualRoomId, "roomId");

      // Secure: Verify user via getUser (already in withAuth)
      if (!user) {
        return errorResponse("Unauthorized", "UNAUTHENTICATED", 401);
      }

      // Get room details (RLS-protected)
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, name, created_by")
        .eq("id", actualRoomId)
        .single();

      if (roomError || !room) {
        return errorResponse("Room not found", "ROOM_NOT_FOUND", 404);
      }

      // Security: Double-check membership (RLS + explicit query)
      const { data: member, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", actualRoomId)
        .eq("user_id", user.id)
        .single();

      if (memberError || !member || member.status !== "accepted") {
        return errorResponse("Not a member of this room", "NOT_A_MEMBER", 403);
      }

      // Creator leave logic: Secure count check
      if (room.created_by === user.id) {
        const { count, error: countError } = await supabase
          .from("room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", actualRoomId)
          .eq("status", "accepted");

        if (countError) {
          console.error("[Leave Room] Count error:", { userId: user.id, roomId: actualRoomId, error: countError });
          return errorResponse("Failed to verify membership", "MEMBERSHIP_ERROR", 500);
        }

        if (count && count > 1) {
          return errorResponse("Creator must transfer ownership before leaving", "CREATOR_CANNOT_LEAVE", 400);
        }

        // Solo creator: Delete room (RLS-protected)
        const { error: deleteError } = await supabase
          .from("rooms")
          .delete()
          .eq("id", actualRoomId)
          .eq("created_by", user.id); // ← Extra security layer

        if (deleteError) {
          console.error("[Leave Room] Delete error:", { userId: user.id, roomId: actualRoomId, error: deleteError });
          return errorResponse("Failed to delete room", "DELETE_ERROR", 500);
        }

        // Clean up memberships (cascade via FK or explicit)
        await supabase.from("room_members").delete().eq("room_id", actualRoomId);
      } else {
        // Non-creator: Use correct RPC
        const { data: rpcResult, error: leaveError } = await supabase.rpc("remove_from_room", { // ← Fixed RPC name
          p_room_id: actualRoomId,
          p_user_id: user.id
        });

        if (leaveError) {
          console.error("[Leave Room] RPC error:", { userId: user.id, roomId: actualRoomId, error: leaveError });
          throw new Error(`Leave failed: ${leaveError.message}`);
        }

        // Handle RPC response (e.g., if it returns { success, action })
        if (!rpcResult?.success) {
          return errorResponse(rpcResult?.message ?? "Failed to leave room", "LEAVE_FAILED", 400);
        }
      }

      // Get remaining rooms (minimized exposure)
      const { data: otherRooms, error: otherError } = await supabase
        .from("room_members")
        .select(`
          room_id,
          rooms!room_id_fkey (name)  // ← Join for name only (secure)
        `)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .limit(1);  // ← Only need first for default (removed .single() to avoid error on empty)

      const hasOtherRooms = !!otherRooms?.length;
      const defaultRoom = otherRooms?.[0] ? {
        id: otherRooms[0].room_id,
        name: otherRooms[0].rooms.name
      } : null;

      return successResponse({
        message: `Successfully left "${room.name}"`,
        roomLeft: { id: room.id, name: room.name },
        hasOtherRooms,
        defaultRoom
      }, 200);
    } catch (error: any) {
      console.error("[Leave Room] Full error:", {
        userId: user?.id,
        roomId: actualRoomId, // ← Now accessible
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
    }
  })(request); // ← Pass request to withAuth for header-based auth
}

// Other methods unchanged (but secure them similarly if used)
export async function GET(request: NextRequest) {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function POST(request: NextRequest) {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function PUT(request: NextRequest) {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

export async function DELETE(request: NextRequest) {
  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}