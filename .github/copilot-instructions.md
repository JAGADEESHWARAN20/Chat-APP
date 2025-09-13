# AI Agent Instructions for Chat-APP

## Project Overview

This is a real-time chat application built with Next.js 13+ and Supabase, featuring room-based messaging, presence indicators, notifications, and theme support.

## Key Architecture Components

### 1. Database Schema & Relationships

- **Rooms System**: Managed through `rooms`, `room_members`, and `room_participants` tables
- **Messaging**: Uses `messages` table with relations to rooms, direct chats, and users
- **Notifications**: Handles through `notifications` table with complex relationships
- **Key File**: `database.types.ts` defines the complete type schema

### 2. Component Structure

- **Layout Components**:
  - `ChatLayout.tsx`: Main layout wrapper
  - `LeftSidebar.tsx`: Room navigation
  - `ClientChatContent.tsx`: Main chat area
  - `ChatHeader.tsx`: Room info and actions
  - `ChatMessages.tsx`: Message display
  - `ChatInput.tsx`: Message input

### 3. State Management

- Uses multiple store files in `lib/store/`:
  - `roomstore.ts`: Room state and actions
  - `user.ts`: User state
  - `messages.ts`: Message handling
  - `notifications.ts`: Notification state

### 4. API Structure

- Routes under `app/api/`:
  - `/messages/[roomId]`: Get room messages
  - `/messages/send`: Send new messages
  - `/rooms/[roomId]/join`: Room membership
  - `/notifications/*`: Notification handling

## Key Workflows

### Authentication

- Uses Supabase auth with Next.js middleware
- Login/Register flows in `app/auth/` directory
- Auth state managed through Supabase client

### Room Management

1. Creation: Uses `create_room_with_member` Supabase function
2. Joining: Calls `/api/rooms/[roomId]/join` endpoint
3. Leaving: Uses `leave_room` Supabase function
4. Messages: Posts to `/api/messages/send` with room context

### Real-time Features

- Presence tracking via `useRoomPresence` hook
- Typing indicators with `useTypingStatus`
- Message updates through Supabase realtime subscriptions

## Common Patterns

### Data Fetching

```typescript
// Example from components using Supabase client
const { data } = await supabase
  .from("rooms")
  .select("*")
  .eq("id", roomId)
  .single();
```

### Error Handling

- API routes use structured error responses
- Client-side uses toast notifications for user feedback
- Error utilities in `lib/utils/errors.ts`

### UI Components

- Built on shadcn/ui components in `components/ui/`
- Theme support through `theme-provider.tsx`
- Responsive design with tailwind classes

## Project-Specific Conventions

### State Updates

- Room changes go through RoomContext/Provider
- Message updates use messages store
- User presence managed by presence hooks

### CSS/Styling

- Uses Tailwind with custom configuration
- Dark/light theme support
- Component-specific styles through cn utility

### Type Safety

- Database types generated from Supabase schema
- Component props strictly typed
- API responses follow defined interfaces

## Common Operations

- To create a room: Use `RoomActionButton` component
- To join a room: Call `handleJoinRoom` in `RoomList`
- To send messages: Use `ChatInput` component
- To handle notifications: Use `NotificationsWrapper`

This documentation focuses on patterns specific to this project. For standard Next.js or Supabase patterns, refer to their respective documentation.
