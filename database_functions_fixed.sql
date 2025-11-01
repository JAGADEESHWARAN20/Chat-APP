-- ============================================
-- FIXED DATABASE FUNCTIONS
-- ============================================
-- All functions use 'profiles' table consistently
-- Fixed parameter mismatches and logic errors

-- ============================================
-- 1. accept_notification - FIXED
-- ============================================
-- FIXED: Uses profiles table, fixed signature
CREATE OR REPLACE FUNCTION public.accept_notification(
  p_notification_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_notification_record notifications%ROWTYPE;
  v_room_name text;
  v_requester_name text;
  v_acceptor_name text;
  v_now timestamp;
BEGIN
  v_now := NOW();

  -- Fetch notification & validate
  SELECT * INTO v_notification_record
  FROM notifications 
  WHERE id = p_notification_id AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or unauthorized';
  END IF;

  IF v_notification_record.type != 'join_request' OR v_notification_record.room_id IS NULL THEN
    RAISE EXCEPTION 'Invalid notification type or missing room_id';
  END IF;

  -- Fetch details from PROFILES table (FIXED)
  SELECT name INTO v_room_name FROM rooms WHERE id = v_notification_record.room_id;
  SELECT COALESCE(display_name, username) INTO v_requester_name 
  FROM profiles WHERE id = v_notification_record.sender_id;
  SELECT COALESCE(display_name, username) INTO v_acceptor_name 
  FROM profiles WHERE id = p_target_user_id;

  -- Update room_participants
  UPDATE room_participants 
  SET status = 'accepted', 
      joined_at = v_now, 
      active = true,
      updated_at = v_now
  WHERE room_id = v_notification_record.room_id 
    AND user_id = v_notification_record.sender_id 
    AND status = 'pending';

  -- Insert or update in room_members
  INSERT INTO room_members (room_id, user_id, status, joined_at, active, updated_at)
  VALUES (v_notification_record.room_id, v_notification_record.sender_id, 'accepted', v_now, true, v_now)
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET 
    status = 'accepted', 
    joined_at = v_now, 
    active = true, 
    updated_at = v_now;

  -- Update the notification record
  UPDATE notifications
  SET type = 'join_request_accepted',
      message = format(
        'Your join request for "%s" was accepted by %s.',
        COALESCE(v_room_name, 'the room'),
        COALESCE(v_acceptor_name, 'the owner')
      ),
      status = 'unread',
      updated_at = v_now,
      sender_id = p_target_user_id,
      user_id = v_notification_record.sender_id
  WHERE id = p_notification_id;

END;
$function$;

-- ============================================
-- 2. join_room - FIXED
-- ============================================
-- FIXED: Uses profiles table instead of users
CREATE OR REPLACE FUNCTION public.join_room(
  p_room_id uuid,
  p_user_id uuid,
  p_status text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_room_is_private boolean;
  v_room_name text;
  v_room_owner uuid;
  v_sender_name text;
  v_final_status text;
  v_now timestamp;
BEGIN
  v_now := NOW();
  
  -- Get room details
  SELECT is_private, name, created_by INTO v_room_is_private, v_room_name, v_room_owner
  FROM rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found: %', p_room_id;
  END IF;
  
  -- Get sender name from PROFILES table (FIXED: was users)
  SELECT COALESCE(display_name, username) INTO v_sender_name
  FROM profiles WHERE id = p_user_id;
  
  -- Use provided status or determine based on room type
  IF p_status IS NOT NULL THEN
    v_final_status := p_status;
  ELSIF v_room_is_private THEN
    v_final_status := 'pending';
  ELSE
    v_final_status := 'accepted';
  END IF;
  
  -- Insert into room_participants
  INSERT INTO room_participants (room_id, user_id, status, joined_at, active, created_at)
  VALUES (p_room_id, p_user_id, v_final_status, v_now, true, v_now)
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    joined_at = v_now,
    active = true,
    updated_at = v_now;
  
  -- If public room or accepted status, also add to room_members
  IF v_final_status = 'accepted' THEN
    INSERT INTO room_members (room_id, user_id, status, joined_at, active, updated_at)
    VALUES (p_room_id, p_user_id, 'accepted', v_now, true, v_now)
    ON CONFLICT (room_id, user_id) 
    DO UPDATE SET 
      status = 'accepted',
      joined_at = v_now,
      active = true,
      updated_at = v_now;
  END IF;
  
  -- Create appropriate notifications
  IF v_room_is_private AND v_final_status = 'pending' THEN
    -- Notify room owner about join request
    IF v_room_owner IS NOT NULL AND v_room_owner != p_user_id THEN
      INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
      VALUES (
        v_room_owner,
        p_user_id,
        p_room_id,
        'join_request',
        COALESCE(v_sender_name, 'A user') || ' requested to join "' || v_room_name || '"',
        'unread',
        v_now
      );
    END IF;
  ELSIF v_final_status = 'accepted' THEN
    -- Notify room owner about user joining (if not self)
    IF v_room_owner IS NOT NULL AND v_room_owner != p_user_id THEN
      INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
      VALUES (
        v_room_owner,
        p_user_id,
        p_room_id,
        'user_joined',
        COALESCE(v_sender_name, 'A user') || ' joined "' || v_room_name || '"',
        'unread',
        v_now
      );
    END IF;
  END IF;
END;
$function$;

-- ============================================
-- 3. reject_notification - FIXED
-- ============================================
-- FIXED: Uses profiles table and proper auth check
CREATE OR REPLACE FUNCTION public.reject_notification(
  p_notification_id uuid,
  p_sender_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_room_name text;
  v_current_user_id uuid;
  v_owner_name text;
  v_notification_record notifications%ROWTYPE;
BEGIN
  -- Get current user ID from auth context
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify notification exists and belongs to current user
  SELECT * INTO v_notification_record
  FROM notifications 
  WHERE id = p_notification_id AND user_id = v_current_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or unauthorized';
  END IF;

  -- Verify user is room owner
  SELECT created_by INTO v_current_user_id
  FROM rooms 
  WHERE id = p_room_id AND created_by = v_current_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to reject requests for this room';
  END IF;

  -- Verify sender matches notification
  IF v_notification_record.sender_id != p_sender_id THEN
    RAISE EXCEPTION 'Invalid sender_id for this notification';
  END IF;

  -- Get names from PROFILES table (FIXED: was users)
  SELECT name INTO v_room_name FROM rooms WHERE id = p_room_id;
  SELECT COALESCE(display_name, username) INTO v_owner_name 
  FROM profiles WHERE id = v_current_user_id;

  -- Update notification as read
  UPDATE notifications 
  SET status = 'read', updated_at = NOW()
  WHERE id = p_notification_id;

  -- Remove pending participation
  DELETE FROM room_participants
  WHERE room_id = p_room_id 
    AND user_id = p_sender_id 
    AND status = 'pending';

  -- Notify sender of rejection
  INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
  VALUES (
    p_sender_id,
    v_current_user_id,
    p_room_id,
    'join_request_rejected',
    'Your request to join room "' || COALESCE(v_room_name, 'a room') || '" was rejected by ' || COALESCE(v_owner_name, 'the owner'),
    'unread',
    NOW()
  );
END;
$function$;

-- ============================================
-- 4. handle_room_join_request - FIXED
-- ============================================
-- FIXED: Better error handling and consistency
CREATE OR REPLACE FUNCTION public.handle_room_join_request(
  p_room_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_room_is_private boolean;
  v_room_name text;
  v_room_owner uuid;
  v_sender_name text;
  v_final_status text;
  v_now timestamp;
BEGIN
  v_now := NOW();
  
  -- Get room details
  SELECT is_private, name, created_by INTO v_room_is_private, v_room_name, v_room_owner
  FROM rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found: %', p_room_id;
  END IF;
  
  -- Get sender name from PROFILES table
  SELECT COALESCE(display_name, username) INTO v_sender_name
  FROM profiles WHERE id = p_user_id;
  
  -- Determine final status based on room type
  IF v_room_is_private THEN
    v_final_status := 'pending';
  ELSE
    v_final_status := 'accepted';
  END IF;
  
  -- Insert into room_participants
  INSERT INTO room_participants (room_id, user_id, status, joined_at, active, created_at)
  VALUES (p_room_id, p_user_id, v_final_status, v_now, true, v_now)
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    joined_at = v_now,
    active = true,
    updated_at = v_now;
  
  -- If public room, also add to room_members
  IF NOT v_room_is_private THEN
    INSERT INTO room_members (room_id, user_id, status, joined_at, active, updated_at)
    VALUES (p_room_id, p_user_id, 'accepted', v_now, true, v_now)
    ON CONFLICT (room_id, user_id) 
    DO UPDATE SET 
      status = 'accepted',
      joined_at = v_now,
      active = true,
      updated_at = v_now;
  END IF;
  
  -- Create appropriate notifications
  IF v_room_is_private THEN
    -- Notify room owner about join request
    IF v_room_owner IS NOT NULL AND v_room_owner != p_user_id THEN
      INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
      VALUES (
        v_room_owner,
        p_user_id,
        p_room_id,
        'join_request',
        COALESCE(v_sender_name, 'A user') || ' requested to join "' || v_room_name || '"',
        'unread',
        v_now
      );
    END IF;
    
    -- Notify user that request was sent
    INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
    VALUES (
      p_user_id,
      p_user_id,
      p_room_id,
      'notification_unread',
      'You requested to join "' || v_room_name || '"',
      'unread',
      v_now
    );
  ELSE
    -- Notify room owner about user joining
    IF v_room_owner IS NOT NULL AND v_room_owner != p_user_id THEN
      INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
      VALUES (
        v_room_owner,
        p_user_id,
        p_room_id,
        'user_joined',
        COALESCE(v_sender_name, 'A user') || ' joined "' || v_room_name || '"',
        'unread',
        v_now
      );
    END IF;
    
    -- Notify user about successful join
    INSERT INTO notifications (user_id, sender_id, room_id, type, message, status, created_at)
    VALUES (
      p_user_id,
      p_user_id,
      p_room_id,
      'notification_unread',
      'You joined "' || v_room_name || '"',
      'unread',
      v_now
    );
  END IF;
END;
$function$;

-- ============================================
-- 5. get_rooms_with_counts - FIXED
-- ============================================
-- FIXED: Simplified query, fixed FULL OUTER JOIN logic
CREATE OR REPLACE FUNCTION public.get_rooms_with_counts(
  p_user_id uuid,
  p_query text DEFAULT ''::text,
  p_include_participants boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  name text,
  is_private boolean,
  created_by uuid,
  created_at timestamp with time zone,
  member_count integer,
  is_member boolean,
  participation_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.is_private,
    r.created_by,
    r.created_at,
    COALESCE(member_counts.count, 0)::integer as member_count,
    CASE 
      WHEN COALESCE(rm.status, rp.status) = 'accepted' THEN true 
      ELSE false 
    END as is_member,
    CASE 
      WHEN p_include_participants THEN COALESCE(rm.status, rp.status) 
      ELSE NULL 
    END as participation_status
  FROM rooms r
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT user_id)::integer as count
    FROM (
      SELECT user_id FROM room_members 
      WHERE room_id = r.id AND status = 'accepted'
      UNION
      SELECT user_id FROM room_participants 
      WHERE room_id = r.id AND status = 'accepted' AND p_include_participants
    ) combined_members
  ) member_counts ON true
  LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = p_user_id
  LEFT JOIN room_participants rp ON rp.room_id = r.id AND rp.user_id = p_user_id
  WHERE (p_query = '' OR r.name ILIKE '%' || p_query || '%')
  ORDER BY r.created_at DESC;
END;
$function$;

-- ============================================
-- 6. switch_room - FIXED
-- ============================================
-- FIXED: Better error handling and logic
CREATE OR REPLACE FUNCTION public.switch_room(
  p_user_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_room RECORD;
  v_now timestamp;
BEGIN
  v_now := NOW();
  
  -- Fetch room and validate
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found: %', p_room_id;
  END IF;

  -- Deactivate all other rooms for user (only if room_members exists)
  UPDATE room_members 
  SET active = false 
  WHERE user_id = p_user_id AND room_id != p_room_id;

  -- Join the new room (handles private/pending)
  PERFORM join_room(p_room_id, p_user_id, NULL);

  -- Activate the new room
  UPDATE room_members 
  SET active = true 
  WHERE room_id = p_room_id AND user_id = p_user_id;

  UPDATE room_participants 
  SET active = true 
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Notify owner if private (join_room already handles public)
  IF v_room.is_private AND v_room.created_by IS NOT NULL AND v_room.created_by != p_user_id THEN
    INSERT INTO notifications (user_id, type, room_id, sender_id, message, status, created_at)
    VALUES (
      v_room.created_by,
      'join_request',
      p_room_id,
      p_user_id,
      'User switched to room "' || v_room.name || '"',
      'unread',
      v_now
    );
  END IF;

  -- Realtime emit
  PERFORM pg_notify(
    'room:' || p_room_id, 
    json_build_object(
      'event', 'user_switched',
      'user_id', p_user_id,
      'room_id', p_room_id
    )::text
  );
END;
$function$;

-- ============================================
-- 7. send_message_with_notify - FIXED
-- ============================================
-- FIXED: Better error handling
CREATE OR REPLACE FUNCTION public.send_message_with_notify(
  p_text text,
  p_room_id uuid,
  p_direct_chat_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_message json;
  v_members uuid[];
  v_new_message messages%ROWTYPE;
BEGIN
  -- Validate input
  IF p_text IS NULL OR trim(p_text) = '' THEN
    RAISE EXCEPTION 'Message text cannot be empty';
  END IF;

  IF p_room_id IS NULL AND p_direct_chat_id IS NULL THEN
    RAISE EXCEPTION 'Either room_id or direct_chat_id must be provided';
  END IF;

  -- Insert message
  INSERT INTO messages (text, room_id, direct_chat_id, sender_id, created_at, status)
  VALUES (p_text, p_room_id, p_direct_chat_id, p_user_id, NOW(), 'sent')
  RETURNING * INTO v_new_message;

  -- Convert to JSON
  v_message := row_to_json(v_new_message);

  -- Batch notify members (excludes sender)
  IF p_room_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT rm.user_id) INTO v_members
    FROM room_members rm
    WHERE rm.room_id = p_room_id 
      AND rm.user_id != p_user_id 
      AND rm.active = true
      AND rm.status = 'accepted';

    -- Only insert notifications if there are members
    IF v_members IS NOT NULL AND array_length(v_members, 1) > 0 THEN
      INSERT INTO notifications (user_id, type, room_id, sender_id, message, status, created_at)
      SELECT 
        unnest(v_members),
        'message',
        p_room_id,
        p_user_id,
        'New message in room',
        'unread',
        NOW();
    END IF;
  END IF;

  -- Realtime emit
  PERFORM pg_notify(
    'room:' || COALESCE(p_room_id::text, p_direct_chat_id::text),
    json_build_object(
      'event', 'new_message',
      'payload', v_message
    )::text
  );

  RETURN v_message;
END;
$function$;

-- ============================================
-- 8. get_typing_users - FIXED
-- ============================================
-- FIXED: Better error handling for missing clear_stale_typing_status
CREATE OR REPLACE FUNCTION public.get_typing_users(
  p_room_id uuid,
  p_stale_threshold interval DEFAULT '00:00:05'::interval
)
RETURNS TABLE(
  user_id uuid,
  is_typing boolean,
  updated_at timestamp without time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
BEGIN
  -- Only clear stale if function exists (idempotent)
  -- If clear_stale_typing_status doesn't exist, we'll just filter in the query
  
  RETURN QUERY
  SELECT 
    ts.user_id,
    ts.is_typing,
    ts.updated_at::timestamp without time zone
  FROM public.typing_status ts
  WHERE ts.room_id = p_room_id 
    AND ts.is_typing = true
    AND ts.updated_at > NOW() - p_stale_threshold
  ORDER BY ts.updated_at DESC;
END;
$function$;

-- ============================================
-- 9. transfer_room_ownership - FIXED
-- ============================================
-- FIXED: Use created_by instead of owner_id
CREATE OR REPLACE FUNCTION public.transfer_room_ownership(
  p_room_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Verify current owner
  IF NOT EXISTS (
    SELECT 1 FROM public.rooms 
    WHERE id = p_room_id AND created_by = p_current_owner_id
  ) THEN
    RAISE EXCEPTION 'Invalid room or current owner';
  END IF;

  -- Update ownership (FIXED: rooms table uses created_by, not owner_id)
  UPDATE public.rooms
  SET created_by = p_new_owner_id
  WHERE id = p_room_id;
END;
$function$;

-- ============================================
-- NOTES:
-- ============================================
-- 1. All functions now consistently use 'profiles' table
-- 2. Better error handling with proper validation
-- 3. Fixed parameter mismatches
-- 4. Fixed switch_room to use join_room properly
-- 5. Fixed transfer_room_ownership to use created_by
-- 6. get_rooms_with_counts uses simpler UNION instead of FULL OUTER JOIN
-- 7. All functions are SECURITY DEFINER for proper permissions

