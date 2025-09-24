// /app/api/rooms/[roomId]/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    console.log("=== JOIN API STARTED ===");
    
    // ✅ Multiple ways to extract roomId for debugging
    const params = await context.params;
    const roomIdFromParams = params.roomId;
    
    // Alternative: extract from URL path
    const url = new URL(request.url);
    const pathname = url.pathname;
    const pathSegments = pathname.split('/').filter(segment => segment.length > 0);
    const roomIdFromPath = pathSegments[pathSegments.length - 2]; // roomId is before 'join'
    
    console.log("🔍 DEBUG INFO:");
    console.log("roomIdFromParams:", roomIdFromParams);
    console.log("roomIdFromPath:", roomIdFromPath);
    console.log("Full URL:", request.url);
    console.log("Pathname:", pathname);
    console.log("Path segments:", pathSegments);
    
    // Use the first valid roomId
    const roomId = roomIdFromParams || roomIdFromPath;
    
    console.log("Final roomId to use:", roomId);
    console.log("roomId length:", roomId?.length);
    console.log("roomId trimmed length:", roomId?.trim().length);
    console.log("Is roomId empty?", !roomId || roomId.trim().length === 0);
    
    if (!roomId || roomId.trim().length === 0) {
      console.log("❌ VALIDATION FAILED - Room ID is empty");
      return NextResponse.json({ 
        error: "Invalid room ID",
        debug: {
          roomIdFromParams,
          roomIdFromPath,
          pathname,
          pathSegments,
          receivedRoomId: roomId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    console.log("✅ Room ID validation passed");
    
    const supabase = await supabaseServer();
    
    // ✅ Auth check
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Authentication error" }, { status: 401 });
    }
    
    if (!session?.user) {
      console.error("No session found");
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log("User ID:", userId);
    
    // ✅ Enhanced room existence check with better error handling
    console.log("Checking room existence in database...");
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, created_by, is_private")
      .eq("id", roomId)
      .single();

    if (roomError) {
      console.error("Room database error:", roomError);
      console.error("Error details:", {
        code: roomError.code,
        message: roomError.message,
        details: roomError.details,
        hint: roomError.hint
      });
    }

    if (roomError || !room) {
      console.error("Room not found:", roomId);
      return NextResponse.json(
        { 
          error: "Room not found",
          debug: {
            roomId,
            databaseError: roomError?.message,
            timestamp: new Date().toISOString()
          }
        },
        { status: 404 }
      );
    }

    console.log("✅ Room found:", room.name, room.id);
    
    // ✅ Check if user is already a member
    console.log("Checking existing membership...");
    const { data: existingMember, error: memberError } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError) {
      console.error("Member check error:", memberError);
    }

    const { data: existingParticipant, error: participantError } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (participantError) {
      console.error("Participant check error:", participantError);
    }

    console.log("Existing member status:", existingMember?.status);
    console.log("Existing participant status:", existingParticipant?.status);

    if (
      existingMember?.status === "accepted" ||
      existingParticipant?.status === "accepted"
    ) {
      console.log("User already a member");
      return NextResponse.json({
        success: true,
        status: "accepted",
        message: "Already a member",
        roomJoined: room,
      });
    }

    if (existingParticipant?.status === "pending") {
      console.log("Join request already pending");
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request already sent",
      });
    }

    // ✅ Sender display name
    console.log("Fetching sender profile...");
    const { data: senderProfile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
    }

    const senderName =
      senderProfile?.display_name ||
      senderProfile?.username ||
      session.user.email ||
      "A user";

    console.log("Sender name:", senderName);

    const now = new Date().toISOString();

    // 🔹 Handle Private Room (join request)
    if (room.is_private) {
      console.log("Handling private room join request...");
      
      const { error: upsertError } = await supabase.from("room_participants").upsert(
        {
          room_id: roomId,
          user_id: userId,
          status: "pending",
          joined_at: now,
          active: true,
          created_at: now,
        },
        { onConflict: "room_id, user_id" }
      );

      if (upsertError) {
        console.error("Private room upsert error:", upsertError);
        return NextResponse.json(
          { error: "Failed to send join request" },
          { status: 500 }
        );
      }

      // notify room owner
      if (room.created_by && room.created_by !== userId) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          user_id: room.created_by,
          sender_id: userId,
          room_id: roomId,
          type: "join_request",
          message: `${senderName} requested to join "${room.name}"`,
          status: "unread",
          created_at: now,
        });

        if (notificationError) {
          console.error("Notification error:", notificationError);
        }
      }

      console.log("✅ Private room join request sent");
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Join request sent to room owner",
      });
    }

    // 🔹 Handle Public Room (auto-join)
    console.log("Handling public room auto-join...");
    
    const { error: participantUpsertError } = await supabase.from("room_participants").upsert(
      {
        room_id: roomId,
        user_id: userId,
        status: "accepted",
        joined_at: now,
        active: true,
        created_at: now,
      },
      { onConflict: "room_id, user_id" }
    );

    if (participantUpsertError) {
      console.error("Public room participant upsert error:", participantUpsertError);
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 }
      );
    }

    const { error: memberUpsertError } = await supabase.from("room_members").upsert(
      {
        room_id: roomId,
        user_id: userId,
        status: "accepted",
        joined_at: now,
        active: true,
        updated_at: now,
      },
      { onConflict: "room_id, user_id" }
    );

    if (memberUpsertError) {
      console.error("Public room member upsert error:", memberUpsertError);
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 }
      );
    }

    // notify room owner
    if (room.created_by && room.created_by !== userId) {
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: room.created_by,
        sender_id: userId,
        room_id: roomId,
        type: "user_joined",
        message: `${senderName} joined "${room.name}"`,
        status: "unread",
        created_at: now,
      });

      if (notificationError) {
        console.error("Join notification error:", notificationError);
      }
    }

    // ✅ Count members for response
    console.log("Counting room members...");
    const { count: memberCount, error: countError } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "accepted");

    if (countError) {
      console.error("Member count error:", countError);
    }

    console.log("✅ Public room join successful");
    return NextResponse.json({
      success: true,
      status: "accepted",
      message: "Joined room successfully",
      roomJoined: room,
      memberCount: memberCount ?? 0,
    });

  } catch (err: any) {
    console.error("💥 JOIN API UNEXPECTED ERROR:", err);
    console.error("Error stack:", err.stack);
    
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: err.message,
        debug: process.env.NODE_ENV === 'development' ? {
          stack: err.stack,
          timestamp: new Date().toISOString()
        } : undefined
      },
      { status: 500 }
    );
  }
}