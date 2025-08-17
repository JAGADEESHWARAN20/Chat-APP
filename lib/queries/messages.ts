// lib/queries/messages.ts

// ✅ Shared query string for messages + profiles join
export const MESSAGE_WITH_PROFILE_SELECT = `
  *,
  profiles:profiles!messages_sender_id_fkey (
    id,
    display_name,
    avatar_url,
    username,
    bio,
    created_at,
    updated_at
  )
`;
