import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  successResponse,
  errorResponse,
  withRateLimit,
} from "@/lib/api-utils";

const paramsSchema = z.object({
  notificationId: z.string().uuid(),
});

const actionSchema = z.object({
  action: z.enum(["read", "unread", "accept", "reject"]),
  roomId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
});

/* ---------------------------------------------
   PATCH /api/notifications/[notificationId]
---------------------------------------------- */
export const PATCH = (req: NextRequest, ctx: { params: { notificationId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { notificationId } = paramsSchema.parse(ctx.params);
      const body = actionSchema.parse(await req.json());

      // Rate limit
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await withRateLimit(`notif-action-${ip}`);

      const { error } = await supabase.rpc("handle_notification_action", {
        p_notification_id: notificationId,
        p_user_id: user.id,
        p_action: body.action,
        p_room_id: body.roomId,
        p_sender_id: body.senderId,
      });

      if (error) {
        return errorResponse(error.message, "ACTION_FAILED", 400);
      }

      return successResponse({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ");
        return errorResponse("Validation error", "VALIDATION_ERROR", 400, {
          details,
        });
      }

      console.error("[PATCH Notification] Error:", err);
      return errorResponse("Internal error", "INTERNAL_ERROR", 500);
    }
  })(req);

/* ---------------------------------------------
   DELETE /api/notifications/[notificationId]
---------------------------------------------- */
export const DELETE = (req: NextRequest, ctx: { params: { notificationId: string } }) =>
  withAuth(async ({ supabase, user }) => {
    try {
      const { notificationId } = paramsSchema.parse(ctx.params);

      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await withRateLimit(`notif-delete-${ip}`);

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) {
        return errorResponse(error.message, "DELETE_FAILED", 500);
      }

      return successResponse({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return errorResponse("Invalid notification ID", "INVALID_ID", 400);
      }

      console.error("[DELETE Notification] Error:", err);
      return errorResponse("Internal error", "INTERNAL_ERROR", 500);
    }
  })(req);
