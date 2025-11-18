# Database Functions Documentation

## RPC Functions

### 1. accept_join_request
**Security**: DEFINER  
**Signature**: `accept_join_request(p_room_id uuid, p_user_id uuid, p_owner_id uuid) RETURNS json`

Allows room owners to approve pending join requests. Validates ownership, promotes requester status to 'accepted', and adds them to room members.

**Flow**:
- Validates room existence and owner authorization
- Updates room_participants status to 'accepted'
- Inserts user into room_members table
- Returns success confirmation

---


### 3. batch_mark_messages_read
**Security**: DEFINER  
**Signature**: `batch_mark_messages_read(p_message_ids uuid[], p_user_id uuid) RETURNS void`

Atomic operation to mark multiple messages as read for a user. Efficiently handles bulk read status updates.

**Flow**:
- Updates existing read records with current timestamp
- Inserts new read status entries for unread messages
- Uses UNNEST + ON CONFLICT for optimal performance
- Fully idempotent and thread-safe

---

### 4. create_room_with_member
**Security**: DEFINER  
**Signature**: `create_room_with_member(p_is_private boolean, p_name text, p_timestamp timestamptz, p_user_id uuid) RETURNS TABLE(...)`

Atomic room creation with automatic creator membership. Handles complete room setup in single transaction.

**Flow**:
- Creates new room record
- Adds creator as accepted member
- Sets up participation tracking
- Returns complete room details

---

### 5. get_messages
**Security**: DEFINER  
**Signature**: `get_messages(room_id uuid) RETURNS SETOF messages`

Retrieves latest 50 messages from specified room. Primary function for chat history loading.

**Flow**:
- Filters messages by room_id
- Orders by creation date (newest first)
- Limits to 50 most recent messages
- Returns complete message objects

---

### 6. get_room_members
**Security**: INVOKER  
**Signature**: `get_room_members(room_id_param uuid) RETURNS TABLE(room_id uuid, user_ids uuid[], member_count bigint)`

Aggregates room membership into compact format. Used for presence tracking and member lists.

**Flow**:
- Groups members by room_id
- Aggregates user IDs into array
- Calculates total member count
- Returns single row per room

---

### 7. get_rooms_with_counts
**Security**: DEFINER  
**Signature**: `get_rooms_with_counts(p_user_id uuid, p_query text DEFAULT NULL, p_include_participants boolean DEFAULT true) RETURNS TABLE(...)`

Comprehensive room listing with membership context. Powers room discovery and search interfaces.

**Flow**:
- Fetches room metadata with member counts
- Determines user membership status
- Provides participation context
- Supports text search filtering

---

### 8. get_rooms_with_details
**Security**: DEFINER  
**Signature**: `get_rooms_with_details() RETURNS TABLE(...)`

Enhanced room listing with latest message context. Ideal for sidebar previews and dashboards.

**Flow**:
- Includes latest message content and timestamp
- Calculates active member counts only
- Provides membership and participation status
- Ordered by room creation date

---

### 9. get_typing_users
**Security**: DEFINER  
**Signature**: `get_typing_users(p_room_id uuid, p_stale_threshold interval DEFAULT '00:00:05') RETURNS TABLE(...)`

Tracks real-time typing indicators with stale status cleanup.

**Flow**:
- Filters by room_id and active typing status
- Applies time threshold to exclude stale entries
- Returns user_id and typing metadata
- Supports real-time UI updates

---

### 10. handle_notification_action
**Security**: INVOKER  
**Signature**: `handle_notification_action(p_notification_id uuid, p_user_id uuid, p_action text, p_room_id uuid DEFAULT NULL, p_sender_id uuid DEFAULT NULL) RETURNS void`

Centralized notification action handler. Routes different notification types to appropriate processors.

**Flow**:
- Validates notification ownership
- Routes actions: read/unread/accept/reject
- Triggers corresponding processing functions
- Emits real-time updates

---

### 11. handle_room_join_request
**Security**: DEFINER  
**Signature**: `handle_room_join_request(p_room_id uuid, p_user_id uuid) RETURNS void`

Core join request processor with private/public room logic. Manages notifications and membership transitions.

**Flow**:
- Determines room type and appropriate status
- Handles public (instant join) vs private (pending) logic
- Creates relevant notifications for owners and requesters
- Maintains participation records

---

### 12. join_room
**Security**: DEFINER  
**Signature**: `join_room(p_room_id uuid) RETURNS jsonb`

User-facing room joining endpoint. Handles authentication, membership checks, and appropriate notifications.

**Flow**:
- Authenticates requesting user
- Checks existing membership
- Applies room-type specific join logic
- Returns detailed join result

---

### 13. refresh_room_overview
**Security**: INVOKER  
**Signature**: `refresh_room_overview(room_id uuid) RETURNS void`

Placeholder function for room overview caching system. Currently no-op but maintained for trigger compatibility.

---



### 16. search_rooms
**Security**: DEFINER  
**Signature**: `search_rooms(p_query text DEFAULT '') RETURNS TABLE(...)`

Room search with membership context. Filters rooms by name and provides membership status.

**Flow**:
- Applies text search to room names
- Includes member counts and user membership status
- Returns participation context
- Supports empty query for all rooms

---

### 17. search_users
**Security**: DEFINER  
**Signature**: `search_users(p_query text DEFAULT '') RETURNS TABLE(...)`

User profile search. Finds users by username or display name for chat and invitation features.

**Flow**:
- Searches profiles via username and display_name
- Returns essential user profile data
- Orders by display name preference
- Supports partial matching

---

### 18. send_message_with_notify
**Security**: DEFINER  
**Signature**: `send_message_with_notify(p_text text, p_room_id uuid, p_direct_chat_id uuid, p_user_id uuid) RETURNS json`

Complete message delivery system. Handles message creation, member notifications, and real-time broadcasting.

**Flow**:
- Validates message content and target
- Creates message record
- Notifies all room members except sender
- Emits real-time event via pg_notify

---

### 19. switch_room
**Security**: DEFINER  
**Signature**: `switch_room(p_user_id uuid, p_room_id uuid) RETURNS void`

Room navigation manager. Ensures single active room and proper membership transitions.

**Flow**:
- Deactivates previous room memberships
- Joins/activates new room
- Handles private room notifications
- Emits room switch events

---

### 20. transfer_room_ownership
**Security**: DEFINER  
**Signature**: `transfer_room_ownership(p_room_id uuid, p_current_owner_id uuid, p_new_owner_id uuid) RETURNS void`

Room ownership transfer utility. Validates current ownership and updates room creator.

**Flow**:
- Verifies current ownership
- Updates room created_by field
- Maintains existing member relationships
- Minimal impact operation

---

## Trigger Functions

### 21. create_user_on_signup
**Security**: DEFINER  
**Trigger**: AFTER INSERT on auth.users

Automatic profile creation on user registration. Extracts user metadata and creates corresponding profile.

**Flow**:
- Generates display_name from metadata or email
- Creates username from email prefix
- Sets avatar URL with fallback generation
- Ensures profile creation atomicity

---

### 22. handle_new_user
**Security**: DEFINER  
**Trigger**: AFTER INSERT on auth.users

Legacy user profile handler. Maintained for backward compatibility with enhanced metadata extraction.

---

### 23. sync_auth_user_to_public_users
**Security**: DEFINER  
**Trigger**: AFTER UPDATE on auth.users

Auth-to-profile synchronization. Keeps public profiles updated with auth metadata changes.

**Flow**:
- Mirrors auth metadata updates to profiles
- Maintains consistent user representation
- Handles avatar URL generation
- Supports OAuth profile updates

---

### 24. trigger_refresh_room_overview_on_members
**Security**: INVOKER  
**Trigger**: AFTER INSERT/UPDATE/DELETE on room_members

Room overview cache invalidation on member changes. Maintains data consistency for derived views.

---

### 25. trigger_refresh_room_overview_on_messages
**Security**: INVOKER  
**Trigger**: AFTER INSERT on messages

Room overview cache invalidation on new messages. Ensures latest message data in cached views.

---

### 26. update_public_users_on_auth_update
**Security**: DEFINER  
**Trigger**: AFTER UPDATE on auth.users

Profile synchronization trigger. Updates public profiles when auth user data changes.

**Flow**:
- Synchronizes display_name, username, avatar_url
- Applies consistent fallback logic
- Maintains data integrity across systems

---

### 27. update_updated_at_column
**Security**: INVOKER  
**Trigger**: BEFORE UPDATE on various tables

Generic timestamp updater. Automatically maintains updated_at fields for audit trails.

**Flow**:
- Sets updated_at to current timestamp
- Universal application across tables
- Zero-config maintenance


# Room Join/Leave & Notification Management Functions

## 1. join_room

**Security**: DEFINER  
**Signature**: `join_room(p_room_id uuid) RETURNS jsonb`

User-facing room joining function that handles authentication, membership validation, and smart room access logic based on room type and user role.

### Flow & Logic
- **Authentication Check**: Validates user identity via `auth.uid()`
- **Room Validation**: Confirms room existence and retrieves room metadata
- **Membership Check**: Prevents duplicate active memberships
- **Smart Access Logic**:
  - **Private Rooms**: 
    - Owners → Immediate acceptance (`owner_joined_private_room`)
    - Other users → Pending status with notification to owner (`join_request_sent`)
  - **Public Rooms**: Immediate acceptance for all users (`joined_public_room`)

### Data Operations
- **Room Participants**: Upserts participation record with appropriate status
- **Room Members**: Only adds to members table if status is 'accepted'
- **Notifications**: Sends join request notifications for private room pending requests

### Returns
```json
{
  "success": true,
  "action": "join_request_sent|joined_public_room|owner_joined_private_room",
  "status": "pending|accepted",
  "room_name": "Room Name"
}
```

### Error Handling
- `AUTH_REQUIRED`: User not authenticated
- `ROOM_NOT_FOUND`: Invalid room ID
- `ALREADY_MEMBER`: User already active member
- Generic SQL exceptions with detailed messages

---

## 2. remove_from_room

**Security**: INVOKER  
**Signature**: `remove_from_room(p_room_id uuid, p_user_id uuid DEFAULT NULL) RETURNS jsonb`

Comprehensive room exit handler with owner protection logic to prevent orphaned rooms and ensure clean membership transitions.

### Flow & Logic
- **User Resolution**: Supports both explicit user ID and authenticated context
- **Room & Membership Validation**: Confirms room existence and user membership
- **Owner Protection**: Prevents room owners from leaving if other active members exist
- **Cleanup Strategy**:
  - **Regular Members**: Soft delete (mark as left/inactive)
  - **Owners**: Hard delete only when no other members remain

### Data Operations
- **Regular Members**:
  - Delete from `room_members`
  - Update `room_participants` status to 'left', active to false
- **Room Owners**:
  - Full cascade delete: participants → members → room
  - Only when no other active members exist

### Returns
**Success Cases**:
```json
{
  "success": true,
  "action": "left",
  "message": "Left room successfully"
}
```
```json
{
  "success": true, 
  "action": "owner_deleted",
  "message": "Owner deleted the room"
}
```

**Error Cases**:
```json
{
  "success": false,
  "error": "CREATOR_CANNOT_LEAVE",
  "message": "Owner must transfer ownership before leaving. X members still exist.",
  "members_left": 3
}
```

### Error Handling
- `AUTH_REQUIRED`: Authentication failure
- `ROOM_NOT_FOUND`: Invalid room reference  
- `FOREIGN_KEY_VIOLATION`: Referential integrity issues
- Comprehensive exception trapping with context

---

## 3. accept_notification

**Security**: DEFINER  
**Signature**: `accept_notification(p_notification_id uuid, p_target_user_id uuid) RETURNS void`

Processes join request approvals from room owners. Transforms pending requests into active memberships and updates notification context.

### Flow & Logic
- **Notification Validation**: Ensures notification exists, is accessible, and is a valid join request type
- **Identity Resolution**: Fetches room and user details for personalized messaging
- **Membership Promotion**: Upgrades user from pending → accepted status
- **Notification Transformation**: Converts request notification to acceptance confirmation

### Data Operations
- **Room Participants**: Updates status to 'accepted', sets join timestamp
- **Room Members**: Inserts/updates membership record with accepted status
- **Notifications**: 
  - Updates original notification to acceptance format
  - Switches sender/recipient for proper messaging context

### Business Logic
- Only processes `join_request` notification types
- Requires valid `room_id` association
- Maintains audit trail with timestamps
- Personalizes messages with room and user names

### Error Conditions
- `Notification not found or unauthorized`: Invalid or inaccessible notification
- `Invalid notification type or missing room_id`: Malformed notification data

---

## 4. reject_notification  

**Security**: DEFINER  
**Signature**: `reject_notification(p_notification_id uuid, p_sender_id uuid, p_room_id uuid) RETURNS void`

Handles join request rejections with comprehensive validation and proper notification to the requester.

### Flow & Logic
- **Multi-layer Validation**:
  - User authentication and notification ownership
  - Room ownership verification
  - Sender identity confirmation
- **Clean Rejection Process**: Removes pending participation without affecting other data
- **Transparent Communication**: Notifies requester of rejection with context

### Data Operations
- **Notification Management**: Marks original notification as read
- **Participation Cleanup**: Removes pending participation records
- **Rejection Notification**: Creates new notification informing user of rejection

### Security Features
- Triple validation: notification access + room ownership + sender identity
- Prevents unauthorized rejection attempts
- Ensures data consistency across operations

### Error Conditions
- `User not authenticated`: Auth failure
- `Notification not found or unauthorized`: Invalid notification access
- `Not authorized to reject requests for this room`: Ownership violation
- `Invalid sender_id for this notification`: Data inconsistency detection

---

## Key Integration Points

### User Journey Flow
1. **User requests to join** → `join_room()` → Creates pending request + notification
2. **Owner receives notification** → `accept_notification()` or `reject_notification()`
3. **User leaves room** → `remove_from_room()` → Clean membership cleanup

### Data Consistency
- All functions maintain `room_participants` and `room_members` sync
- Notification lifecycle properly managed from creation to resolution
- Timestamp consistency across related records

### Security Model
- DEFINER functions for data modification operations
- INVOKER functions for membership management
- Comprehensive ownership and access validation
- Protection against orphaned rooms and data inconsistency