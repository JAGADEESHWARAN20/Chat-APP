// app/api/ai-chat/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/types/supabase";

// Use the exact Insert type from your database
type AiChatInsert = Database["public"]["Tables"]["ai_chat_history"]["Insert"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const userId = searchParams.get("userId");

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: "Room ID and User ID are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("ai_chat_history")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching AI chat history:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Error in AI chat history GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      room_id,
      user_id,
      user_query,
      ai_response,
      model_used,
      token_count,
      message_count,
      structured_data,
      analysis_type,
    } = body;

    if (!room_id || !user_id || !user_query || !ai_response) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Create a properly typed insert object
    const insertData: AiChatInsert = {
      room_id,
      user_id,
      user_query,
      ai_response,
      model_used: model_used ?? null,
      token_count: token_count ?? null,
      message_count: message_count ?? null,
      analysis_type: analysis_type ?? null,
      structured_data: structured_data ?? null,
    };

    const { data, error } = await supabase
      .from("ai_chat_history")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Error saving AI chat history:", error);
      return NextResponse.json(
        { error: "Failed to save chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in AI chat history POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const userId = searchParams.get("userId");

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: "Room ID and User ID are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { error } = await supabase
      .from("ai_chat_history")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting AI chat history:", error);
      return NextResponse.json(
        { error: "Failed to delete chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in AI chat history DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}