-- Function to mark a message as read
create or replace function public.mark_message_read(
    p_message_id uuid,
    p_user_id uuid
) returns void as $$
begin
    -- Insert or update read status
    insert into message_read_status (message_id, user_id, read_at)
    values (p_message_id, p_user_id, now())
    on conflict (message_id, user_id)
    do update set read_at = now();
end;
$$ language plpgsql security definer;