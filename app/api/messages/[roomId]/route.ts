import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const roomId = params.roomId;

    // Validate roomId
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "Valid roomId is required" }, { status: 400 });
    }

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch messages for the specific room
    const { data: messages, error: fetchError } = await supabase
      .from("messages")
      .select(`
        id,
        text,
        send_by,
        created_at,
        is_edit,
        users (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Server error in message fetch route:", errorMessage, error);
    return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
  }
}