-- Function to create room with owner
create or replace function public.create_room_with_owner(
    p_name text,
    p_owner_id uuid,
    p_is_private boolean default false
) returns uuid as $$
declare
    v_room_id uuid;
begin
    -- Create new room
    insert into public.rooms (name, owner_id, is_private)
    values (p_name, p_owner_id, p_is_private)
    returning id into v_room_id;

    -- Add owner as a member
    insert into public.room_members (room_id, user_id, status, joined_at)
    values (v_room_id, p_owner_id, 'accepted', now());

    return v_room_id;
end;
$$ language plpgsql security definer;

-- Policy to allow room creation only by authenticated users
create policy "Users can create rooms"
    on public.rooms
    for insert
    with check (auth.uid() = owner_id);

-- Policy to allow updating room only by owner
create policy "Only owner can update room"
    on public.rooms
    for update
    using (auth.uid() = owner_id);

-- Function to transfer room ownership
create or replace function public.transfer_room_ownership(
    p_room_id uuid,
    p_new_owner_id uuid
) returns void as $$
begin
    -- Verify current owner
    if auth.uid() != (select owner_id from public.rooms where id = p_room_id) then
        raise exception 'Only the current owner can transfer ownership';
    end if;

    -- Verify new owner is a member
    if not exists (
        select 1 from public.room_members
        where room_id = p_room_id
        and user_id = p_new_owner_id
        and status = 'accepted'
    ) then
        raise exception 'New owner must be an accepted room member';
    end if;

    -- Update ownership
    update public.rooms
    set owner_id = p_new_owner_id
    where id = p_room_id;

    -- Create notification
    insert into public.notifications (
        type,
        message,
        room_id,
        user_id,
        sender_id
    )
    values (
        'ownership_transfer',
        'You have been made the owner of this room',
        p_room_id,
        p_new_owner_id,
        auth.uid()
    );
end;
$$ language plpgsql security definer;