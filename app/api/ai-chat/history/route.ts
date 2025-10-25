// app/api/ai-chat/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Extended interface to include user queries
interface ChatHistoryItem {
  id: string;
  room_id: string;
  user_id: string;
  user_query: string;
  ai_response: string;
  model_used?: string;
  token_count?: number;
  message_count?: number;
  structured_data?: any;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: 'Room ID and User ID are required' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }) // Changed to ascending to maintain conversation order
      .limit(50);

    if (error) {
      console.error('Error fetching AI chat history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in AI chat history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    } = body;

    if (!room_id || !user_id || !user_query || !ai_response) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('ai_chat_history')
      .insert([
        {
          room_id,
          user_id,
          user_query,
          ai_response,
          model_used,
          token_count,
          message_count,
          structured_data,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving AI chat history:', error);
      return NextResponse.json(
        { error: 'Failed to save chat history' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in AI chat history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: 'Room ID and User ID are required' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    const { error } = await supabase
      .from('ai_chat_history')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting AI chat history:', error);
      return NextResponse.json(
        { error: 'Failed to delete chat history' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in AI chat history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}