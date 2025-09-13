-- Function to batch mark messages as read
create or replace function public.batch_mark_messages_read(
    p_message_ids uuid[],
    p_user_id uuid
) returns void as $$
begin
    -- Insert or update read status for multiple messages
    insert into message_read_status (message_id, user_id, read_at)
    select 
        unnest(p_message_ids),
        p_user_id,
        now()
    on conflict (message_id, user_id)
    do update set read_at = now();
end;
$$ language plpgsql security definer;