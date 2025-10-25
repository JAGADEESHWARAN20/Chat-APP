import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

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
      .order('created_at', { ascending: true })
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
      analysis_type, // Add this field
    } = body;

    if (!room_id || !user_id || !user_query || !ai_response) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    console.log('[AI Chat History] Saving to database:', {
      room_id,
      user_id,
      user_query_length: user_query.length,
      ai_response_length: ai_response.length,
      model_used,
      has_structured_data: !!structured_data,
      analysis_type
    });

    // Build insert data dynamically to handle missing columns
    const insertData: any = {
      room_id,
      user_id,
      user_query,
      ai_response,
      model_used,
      token_count,
      message_count,
    };

    // Only include structured_data if it exists and the column exists
    if (structured_data !== undefined) {
      insertData.structured_data = structured_data;
    }

    // Only include analysis_type if it exists and the column exists  
    if (analysis_type !== undefined) {
      insertData.analysis_type = analysis_type;
    }

    const { data, error } = await supabase
      .from('ai_chat_history')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Error saving AI chat history:', {
        code: error.code,
        message: error.message,
        details: error.details
      });

      // If it's a column error, try without the problematic columns
      if (error.message.includes('structured_data') || error.message.includes('analysis_type')) {
        console.log('Retrying without structured_data and analysis_type...');
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('ai_chat_history')
          .insert([{
            room_id,
            user_id,
            user_query,
            ai_response,
            model_used,
            token_count,
            message_count,
            // Omit structured_data and analysis_type
          }])
          .select()
          .single();

        if (fallbackError) {
          console.error('Fallback insert also failed:', fallbackError);
          return NextResponse.json(
            { error: 'Failed to save chat history even with fallback' },
            { status: 500 }
          );
        }

        console.log('[AI Chat History] Successfully saved with fallback, ID:', fallbackData.id);
        return NextResponse.json(fallbackData);
      }

      return NextResponse.json(
        { error: 'Failed to save chat history' },
        { status: 500 }
      );
    }

    console.log('[AI Chat History] Successfully saved with ID:', data.id);
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