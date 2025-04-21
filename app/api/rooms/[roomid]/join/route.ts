import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
     req: NextRequest,
     { params }: { params: { roomId: string } }
) {
     const supabase = createRouteHandlerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();

     if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const { roomId } = params;
     const userId = session.user.id;

     // Parse the request body
     const { status, joined_at } = await req.json().catch(() => ({
          status: "pending",
          joined_at: new Date().toISOString(),
     }));

     // Validate input
     if (!["pending", "accepted", "rejected"].includes(status)) {
          return NextResponse.json(
               { error: "Invalid status value. Use 'pending', 'accepted', or 'rejected'" },
               { status: 400 }
          );
     }

     // Insert into room_participants table
     const { error } = await supabase
          .from("room_participants")
          .insert({
               room_id: roomId,
               user_id: userId,
               status: status,
               joined_at: joined_at || new Date().toISOString(), // Use provided datetime or current time
          });

     if (error) {
          return NextResponse.json(
               { error: "Failed to join room", details: error.message },
               { status: 500 }
          );
     }

     return NextResponse.json({ success: true, status: status });
}