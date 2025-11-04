import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, validateUUID, errorResponse, successResponse } from "@/lib/api-utils";

const paramsSchema = z.object({ notificationId: z.string().uuid() });
const actionSchema = z.object({
  action: z.enum(["read", "unread", "accept", "reject"]),
  roomId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { notificationId } = paramsSchema.parse(await params);
      const body = actionSchema.parse(await req.json());

      validateUUID(notificationId, "notificationId");

      const { error } = await supabase.rpc("handle_notification_action", {
        p_notification_id: notificationId,
        p_user_id: user.id,
        p_action: body.action,
        p_room_id: body.roomId,
        p_sender_id: body.senderId,
      });

      if (error) {
        return errorResponse(error.message, "RPC_ERROR", 400);
      }

      return successResponse();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.map(issue =>
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        return errorResponse(`Validation failed: ${details}`, "VALIDATION_ERROR", 400);
      }
      console.error("[Notification Action] Error:", error);
      return errorResponse("Internal error", "INTERNAL_ERROR", 500);
    }
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  return withAuth(async ({ supabase, user }) => {
    try {
      const { notificationId } = paramsSchema.parse(await params);
      validateUUID(notificationId, "notificationId");

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) {
        return errorResponse(error.message, "DELETE_ERROR", 500);
      }

      return successResponse();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse("Invalid notification ID", "VALIDATION_ERROR", 400);
      }
      console.error("[Notification Delete] Error:", error);
      return errorResponse("Internal error", "INTERNAL_ERROR", 500);
    }
  });
}