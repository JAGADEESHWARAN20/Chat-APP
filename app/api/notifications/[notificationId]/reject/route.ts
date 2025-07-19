import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const supabase = createServerComponentClient({ cookies });

  const { notification_id, sender_id, room_id } = await req.json();

  if (!notification_id || !sender_id || !room_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Call the `reject_notification` function
    const { error: funcError } = await supabase.rpc('reject_notification', {
      p_notification_id: notification_id,
      p_sender_id: sender_id,
      p_room_id: room_id,
    });

    if (funcError) {
      return NextResponse.json({ error: funcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
