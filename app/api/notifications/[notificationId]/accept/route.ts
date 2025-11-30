import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(
  _req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: cookieStore.getAll,
        setAll: () => {},
      },
    }
  );

  // ------------------ AUTH ------------------
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notificationId = params.notificationId;
  const actingUserId = session.user.id;

  // ------------------ FETCH EXISTING NOTIFICATION ------------------
  const { data: existing, error: fetchError } = await supabase
    .from("notifications")
    .select("id, sender_id, user_id, room_id, type")
    .eq("id", notificationId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const requesterId = existing.sender_id;
  const ownerId = existing.user_id;
  const roomId = existing.room_id;

  if (!requesterId || !roomId) {
    return NextResponse.json({ error: "Invalid notification data" }, { status: 400 });
  }

  // SECURITY: Ensure ONLY owner can accept
  if (ownerId !== actingUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 🎯 Use the fixed SECURITY DEFINER function
  const { error: rpcError } = await supabase.rpc("accept_notification", {
    p_notification_id: notificationId,
    p_target_user_id: actingUserId,
  });

  if (rpcError) {
    console.error("❌ RPC Error:", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  console.log("✅ Join request accepted successfully");

  return NextResponse.json({ 
    success: true,
    message: "Join request accepted",
    room_id: roomId,
    user_id: requesterId
  });
}
