# File Description: `app/api/messages/[roomId]/route.ts`

## Purpose
This file defines a Next.js API route handler for fetching messages associated with a specific chat room in a messaging application.

## Functionality
- **Route**: Handles `GET` requests to `/api/messages/[roomId]`, where `[roomId]` is a dynamic parameter representing the ID of the chat room.
- **Authentication**: Verifies user authentication using Supabase's auth helpers, ensuring only authenticated users can access messages.
- **Data Retrieval**: Queries the Supabase database to fetch messages from the `messages` table for the specified `roomId`, including related user information (e.g., username, display name, avatar URL) from the `users` table.
- **Response**: Returns a JSON response containing the fetched messages or an error message if the request fails.
- **Error Handling**: Includes validation for `roomId`, checks for authentication errors, and handles database query errors, returning appropriate HTTP status codes (400, 401, 500).

## Key Components
- **Supabase Integration**: Uses `@supabase/auth-helpers-nextjs` to manage authentication and database queries.
- **Dynamic Routing**: Utilizes Next.js dynamic routes to capture `roomId` from the URL.
- **Query Structure**: Fetches messages with a join to the `users` table to include sender details, ordered by creation time (descending).
- **Error Logging**: Logs errors to the console for debugging purposes.

## Usage
This route is called when a client needs to retrieve the message history for a specific chat room, typically in a chat application interface.

## File Path
`app/api/messages/[roomId]/route.ts`

# File Description: `app/api/messages/route.ts`

## Purpose
This file defines a Next.js API route handler for sending a new message in a chat room and notifying room members in a messaging application.

## Functionality
- **Route**: Handles `POST` requests to `/api/messages`, accepting a JSON payload with `content` (message text) and `roomId` (target room ID).
- **Authentication**: Verifies user authentication using Supabase's auth helpers, ensuring only authenticated users can send messages.
- **Authorization**: Checks if the authenticated user is a member of the specified room before allowing message submission.
- **Message Insertion**: Inserts the new message into the `messages` table with the provided content, room ID, user ID, creation timestamp, and status ("sent").
- **Room Details**: Retrieves the room's name and creator from the `rooms` table for notification purposes.
- **Sender Information**: Fetches the sender's username from the `users` table.
- **Member Notification**: Identifies other room members (excluding the sender) and inserts notifications into the `notifications` table for each, informing them of the new message.
- **Response**: Returns a JSON response indicating success or an error with appropriate HTTP status codes (401, 403, 404, 500).
- **Error Handling**: Validates inputs, handles database errors, and logs issues for debugging, ensuring robust operation.

## Key Components
- **Supabase Integration**: Uses `@supabase/auth-helpers-nextjs` for authentication and database operations.
- **Dynamic Payload**: Processes JSON input (`content`, `roomId`) from the request body.
- **Database Queries**: Performs multiple queries to validate membership, insert messages, fetch room and user details, and notify members.
- **Notification System**: Creates notifications for room members with details about the new message, including room name and message content.
- **Error Logging**: Logs errors to the console for debugging, with non-critical notification errors logged but not blocking the response.

## Usage
This route is called when a client sends a new message in a chat room, triggering message storage and notifications to other room members in a chat application.

## File Path
`app/api/messages/route.ts`


# File Description: `app/api/messages/send/route.ts`

## Purpose
This file defines a Next.js API route handler for sending a new message in a chat room and broadcasting a notification to all users in a messaging application.

## Functionality
- **Route**: Handles `POST` requests to `/api/messages/send`, accepting a JSON payload with `roomId` (target room ID) and `message` (message content).
- **Authentication**: Verifies user authentication using Supabase's auth helpers, ensuring only authenticated users can send messages.
- **Room Validation**: Checks if the specified room exists in the `rooms` table before processing the message.
- **Message Insertion**: Inserts the new message into the `messages` table with the provided content, room ID, user ID, and creation timestamp.
- **Sender Information**: Retrieves the sender's username from the `users` table for use in notifications.
- **Notification Broadcast**: Sends a real-time notification to all users via a Supabase channel (`global-notifications`), informing them of the new message with details like sender username, room name, and message content.
- **Response**: Returns a JSON response indicating success or an error with appropriate HTTP status codes (401, 404, 500).
- **Error Handling**: Validates inputs, handles database and authentication errors, and logs issues for debugging.

## Key Components
- **Supabase Integration**: Uses `@supabase/auth-helpers-nextjs` for authentication and database operations, and `supabaseServer` for real-time channel communication.
- **Dynamic Payload**: Processes JSON input (`roomId`, `message`) from the request body.
- **Database Queries**: Performs queries to validate the room, insert the message, and fetch the sender's username.
- **Real-Time Notifications**: Broadcasts notifications using Supabase's real-time channel feature, with a unique notification ID generated via.Concurrent `crypto.randomUUID()`.
- **Error Logging**: Logs errors to the console for debugging, including issues with message insertion or sender retrieval.

## Usage
This route is called when a client sends a new message in a chat room, storing the message and broadcasting a notification to all users in real-time, typically for a chat application's messaging feature.

## File Path
`app/api/messages/send/route.ts`

