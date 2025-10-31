import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Database } from "@/lib/types/supabase";

const paramsSchema = z.object({ notificationId: z.string().uuid() });
const actionSchema = z.object({
  action: z.enum(["read", "unread", "accept", "reject"]),
  roomId: z.string().uuid().optional(),  // Already optional → undefined if missing
  senderId: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { notificationId: string } }) {
  console.time('notifications-action');
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { notificationId } = paramsSchema.parse(params);
    const body = actionSchema.parse(await req.json());

    // Fix: Pass directly (optional → undefined; no ?? null)
    const { error } = await supabase.rpc("handle_notification_action", {
      p_notification_id: notificationId,
      p_user_id: session.user.id,
      p_action: body.action,
      p_room_id: body.roomId,  // undefined if absent (matches string | undefined)
      p_sender_id: body.senderId,  // undefined if absent
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    console.timeEnd('notifications-action');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.timeEnd('notifications-action');
    if (err instanceof z.ZodError) {
      const details = err.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: "Validation failed", details }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { notificationId: string } }) {
  console.time('notifications-delete');
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { notificationId } = paramsSchema.parse(params);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", session.user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    console.timeEnd('notifications-delete');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.timeEnd('notifications-delete');
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}