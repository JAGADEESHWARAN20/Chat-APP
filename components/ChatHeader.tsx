import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import ChatPresence from './ChatPresence';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  PlusCircle,
  Bell,
  Reply,
  Settings,
  ArrowRight,
  LogOut,
  UserIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Database } from '@/lib/types/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRoomStore } from '@/lib/store/roomstore';
import { useNotification, Inotification } from '@/lib/store/notifications';
import { useDebounce } from 'use-debounce';
import { API_ROUTES } from '@/lib/apiConfig';
import { useIsMounted } from '@/hooks/useIsMounted';
import Notifications from './Notifications';

type UserProfile = Database['public']['Tables']['users']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type SearchResult = UserProfile | Room;
type Notification = Omit<Database['public']['Tables']['notifications']['Row'], 'user_id'> & {
  user_id?: string;
  rooms?: { name: string };
  users?: { username: string };
};

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'rooms' | 'users' | null>('rooms');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [availableRooms, setAvailableRooms] = useState<(Room & { isMember: boolean })[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = supabaseBrowser();
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { selectedRoom, setSelectedRoom, setRooms } = useRoomStore();
  const { notifications: storeNotifications, fetchNotifications, subscribeToNotifications } = useNotification();
  const isMounted = useIsMounted();
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (isMounted() && storeNotifications?.length > 0) {
      try {
        setNotifications(
          storeNotifications.map((notif: Inotification) => ({
            id: notif.id,
            message: notif.content,
            created_at: notif.created_at,
            status: notif.is_read ? "read" : "unread",
            type: notif.type,
            sender_id: notif.sender_id,
            room_id: notif.room_id,
            user_id: user?.id || "",
            users: notif.users ? { username: notif.users.username } : undefined,
            rooms: notif.rooms ? { name: notif.rooms.name } : undefined,
          }))
        );
      } catch (error) {
        console.error("Failed to process notifications:", error);
      }
    }
  }, [storeNotifications, isMounted, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let initialFetchComplete = false;
    let unsubscribe: (() => void) | undefined;

    const handleInitialFetch = async () => {
      try {
        await fetchNotifications(user.id);
        if (isMounted()) {
          initialFetchComplete = true;
        }
      } catch (error) {
        if (isMounted()) {
          console.error('Failed to fetch initial notifications:', error);
        }
      }
    };

    handleInitialFetch();

    try {
      unsubscribe = subscribeToNotifications(user.id, () => {
        if (!initialFetchComplete && isMounted()) {
          fetchNotifications(user.id).catch(console.error);
        }
      });
    } catch (error) {
      console.error("Failed to subscribe to notifications:", error);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.id, fetchNotifications, subscribeToNotifications, isMounted]);

  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user?.id || !roomId) return false;
      try {
        const { data, error } = await supabase
          .from('room_participants')
          .select('status')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('Error checking room membership:', error);
          }
          return false;
        }
        return data?.status === 'accepted';
      } catch (error) {
        console.error('Error checking room membership:', error);
        return false;
      }
    },
    [user, supabase]
  );

  const fetchAvailableRooms = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: roomsData, error } = await supabase
        .from('room_participants')
        .select('rooms(*)')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Failed to fetch rooms:', error);
        return;
      }

      if (!roomsData) {
        setAvailableRooms([]);
        setRooms([]);
        return;
      }

      const rooms = roomsData
        .map((item) => item.rooms)
        .filter((room): room is Room => room !== null);

      const roomsWithMembership = await Promise.all(
        rooms.map(async (room) => ({
          ...room,
          isMember: await checkRoomMembership(room.id),
        }))
      );

      if (isMounted()) {
        setAvailableRooms(roomsWithMembership);
        setRooms(rooms);
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Error fetching rooms:', error);
      }
    }
  }, [user, supabase, checkRoomMembership, setRooms, isMounted]);

  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
    }
  }, [user?.id, fetchAvailableRooms]);

  const handleRoomSwitch = async (room: Room) => {
    if (!user) {
      toast.error('You must be logged in to switch rooms');
      return;
    }

    if (!room?.id) {
      toast.error('Invalid room selected');
      return;
    }

    try {
      const response = await fetch(API_ROUTES.ROOMS.SWITCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to switch room' }));
        throw new Error(error.error || 'Failed to switch room');
      }

      await response.json();
      if (isMounted()) {
        setSelectedRoom(room);
        setIsSwitchRoomPopoverOpen(false);
        toast.success(`Switched to ${room.name}`);
        await fetchAvailableRooms();
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Switch room error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to switch room');
      }
    }
  };

  const handleLeaveRoom = async () => {
    if (!user) {
      toast.error('You must be logged in to leave a room');
      return;
    }
    if (!selectedRoom?.id) {
      toast.error('No room selected');
      return;
    }

    setIsLeaving(true);
    try {
      const response = await fetch(API_ROUTES.ROOMS.LEAVE(selectedRoom.id), {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to leave room' }));
        throw new Error(error.error || 'Failed to leave room');
      }

      const { hasOtherRooms } = await response.json().catch(() => ({ hasOtherRooms: false }));
      if (isMounted()) {
        toast.success('Left room successfully');
        if (!hasOtherRooms) {
          setSelectedRoom(null);
        } else {
          await fetchAvailableRooms();
        }
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Error leaving room:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to leave room');
      }
    } finally {
      if (isMounted()) {
        setIsLeaving(false);
      }
    }
  };

  const handleAcceptJoinRequest = async (notificationId: string) => {
    if (!notificationId || !user?.id) {
      toast.error('Invalid notification or not logged in');
      return;
    }

    try {
      const response = await fetch(API_ROUTES.NOTIFICATIONS.ACCEPT(notificationId), {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to accept join request' }));
        throw new Error(error.error || 'Failed to accept join request');
      }

      if (isMounted()) {
        toast.success('Join request accepted');
        await fetchNotifications(user.id);
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Error accepting join request:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to accept join request');
      }
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!user) {
      toast.error('You must be logged in to access notifications');
      return;
    }
    if (!notification?.id || !notification.room_id) {
      toast.error('Invalid notification');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notification.id);

      if (updateError) {
        console.error('Failed to update notification status:', updateError);
      }

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', notification.room_id)
        .single();

      if (roomError || !room) {
        console.error('Room not found:', roomError);
        toast.error('Room not found');
        return;
      }

      await handleRoomSwitch(room);

      if (isMounted()) {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
        setIsNotificationsOpen(false);
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Error handling notification:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to process notification');
      }
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedCallback(e.target.value);
  };

  const fetchSearchResults = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const endpoint = debouncedSearchQuery.trim()
        ? `${API_ROUTES.ROOMS.SEARCH}?query=${encodeURIComponent(debouncedSearchQuery)}`
        : API_ROUTES.ROOMS.ALL;

      const response = await fetch(endpoint);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Search failed' }));
        throw new Error(errorData.error || 'Failed to search');
      }

      const data = await response.json().catch(() => ({ rooms: [] }));

      if (isMounted()) {
        const results: Room[] = data.rooms || [];
        const resultsWithMembership = await Promise.all(
          results.map(async (room) => ({
            ...room,
            isMember: await checkRoomMembership(room.id),
          }))
        );
        setSearchResults(resultsWithMembership);
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
    } finally {
      if (isMounted()) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearchQuery, checkRoomMembership, user, isMounted]);

  useEffect(() => {
    if (debouncedSearchQuery !== undefined && searchType === 'rooms') {
      fetchSearchResults();
    }
  }, [debouncedSearchQuery, fetchSearchResults, searchType]);

  useEffect(() => {
    if (selectedRoom?.id && user?.id) {
      checkRoomMembership(selectedRoom.id)
        .then((isMember) => {
          if (isMounted()) {
            setIsMember(isMember);
          }
        })
        .catch((error) => {
          console.error('Error checking membership:', error);
          if (isMounted()) {
            setIsMember(false);
          }
        });
    } else {
      if (isMounted()) {
        setIsMember(false);
      }
    }
  }, [selectedRoom, user, checkRoomMembership, isMounted]);

  const handleCreateRoom = async () => {
    if (!user) {
      toast.error('You must be logged in to create a room');
      return;
    }
    if (!newRoomName.trim()) {
      toast.error('Room name cannot be empty');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(API_ROUTES.ROOMS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_private: isPrivate,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create room' }));
        throw new Error(error.error || 'Failed to create room');
      }

      const newRoom = await response.json().catch(() => ({}));

      if (!newRoom.id) {
        throw new Error('Invalid response from server');
      }

      if (isMounted()) {
        toast.success('Room created successfully!');
        setNewRoomName('');
        setIsPrivate(false);
        setIsDialogOpen(false);
        await handleJoinRoom(newRoom.id);
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Error creating room:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to create room');
      }
    } finally {
      if (isMounted()) {
        setIsCreating(false);
      }
    }
  };

  const handleLoginWithGithub = () => {
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: location.origin + '/auth/callback',
      },
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  const handleSearchByType = (type: 'rooms' | 'users') => {
    setSearchType(type);
    setSearchQuery('');
    if (type === 'rooms') {
      fetchSearchResults();
    } else {
      setSearchResults([]); 
    }
  };

  const handleJoinRoom = async (roomId?: string) => {
    if (!user) {
      toast.error('You must be logged in to join a room');
      return;
    }

    const currentRoomId = roomId || selectedRoom?.id;
    if (!currentRoomId) {
      toast.error('No room selected');
      return;
    }

    try {
      const response = await fetch(API_ROUTES.ROOMS.JOIN(currentRoomId), {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to join room' }));
        throw new Error(errorData.error || 'Failed to join room');
      }

      const data = await response.json().catch(() => ({}));

      if (isMounted()) {
        toast.success(data.message || 'Joined room successfully');

        if (!data.status || data.status === 'accepted') {
          const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', currentRoomId)
            .single();

          if (roomError || !room) {
            console.error('Failed to fetch room details:', roomError);
            return;
          }

          setSelectedRoom(room);
          await fetchAvailableRooms();

          // Only send notification if we successfully joined
          try {
            const notification = {
              id: crypto.randomUUID(),
              user_id: user.id,
              type: 'user_joined',
              room_id: currentRoomId,
              sender_id: user.id,
              message: `${user.email || 'A user'} joined the room ${room.name}`,
              status: 'unread',
              created_at: new Date().toISOString(),
            };

            await supabase
              .channel('global-notifications')
              .send({
                type: 'broadcast',
                event: 'user_joined',
                payload: notification,
              });
          } catch (notifError) {
            console.error('Failed to send join notification:', notifError);
          }
        }
      }
    } catch (error) {
      if (isMounted()) {
        console.error('Error joining room:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to join room');
      }
    }
  };

  const renderRoomSearchResult = (result: Room & { isMember: boolean }) => (
    <li key={result.id} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">
          {result.name} {result.is_private && '🔒'}
        </span>
      </div>
      {selectedRoom?.id === result.id && result.isMember ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-700"
          disabled={isLeaving}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : result.isMember ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRoomSwitch(result)}
          className="flex items-center gap-1 text-white border-gray-600"
        >
          <span className="flex items-center gap-1">
            <ArrowRight className="h-4 w-4" />
            Switch
          </span>
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => handleJoinRoom(result.id)}
          disabled={!user}
        >
          Join
        </Button>
      )}
    </li>
  );

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-gray-900 text-white shadow-sm">
      <h1 className="text-lg font-semibold">
        {selectedRoom ? `#${selectedRoom.name}` : 'Daily Chat'}
      </h1>
      <div className="flex items-center space-x-4">
        <ChatPresence />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <PlusCircle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Create New Room</DialogTitle>
              <DialogDescription className="text-gray-300">
                Create a new chat room. Private rooms require approval to join.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  disabled={isCreating}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  disabled={isCreating}
                />
                <Label htmlFor="private">Private Room</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating}
                className="text-white border-gray-600"
              >
                Cancel
              </Button>
              <Button onClick={handleCreateRoom} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Room'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {selectedRoom && (
          <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Reply className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-gray-800 text-white">
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">Switch Room</h3>
                {availableRooms.length === 0 ? (
                  <p className="text-sm text-gray-400">No rooms available</p>
                ) : (
                  <ul className="space-y-2">
                    {availableRooms.map((room) => (
                      <li key={room.id} className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {room.name} {room.is_private && '🔒'}
                        </span>
                        <Button
                          size="sm"
                          variant={selectedRoom?.id === room.id ? 'secondary' : 'outline'}
                          onClick={() => handleRoomSwitch(room)}
                          className="text-white border-gray-600"
                        >
                          <span className="flex items-center gap-1">
                            <ArrowRight className="h-4 w-4" />
                            Switch
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Notifications
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsNotificationsOpen(true)}
        >
          <Bell className="h-5 w-5" />
          {storeNotifications.filter((n) => !n.is_read).length > 0 && (
            <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
          )}
        </Button>

        <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-gray-800 text-white">
            <div className="p-4">
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsSearchPopoverOpen(false);
                    router.push('/profile');
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <h3 className="font-semibold text-lg mb-2">Search</h3>
              <Input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="mb-4 bg-gray-700 border-gray-600"
              />
              <div className="flex gap-2 mb-4">
                <Button
                  variant={searchType === 'rooms' ? 'default' : 'outline'}
                  onClick={() => handleSearchByType('rooms')}
                  className="text-white border-gray-600"
                >
                  Rooms
                </Button>
                <Button
                  variant={searchType === 'users' ? 'default' : 'outline'}
                  onClick={() => handleSearchByType('users')}
                  className="text-white border-gray-600"
                >
                  Users
                </Button>
              </div>
              {isLoading && (
                <p className="text-sm text-gray-400 mt-2">Loading...</p>
              )}
              {!isLoading && searchResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">
                    {searchType === 'users' ? 'User Profiles' : 'Rooms'}
                  </h4>
                  <ul className="space-y-2">
                    {searchResults.map((result) =>
                      'username' in result ? (
                        <li
                          key={result.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar>
                              {result.avatar_url ? (
                                <AvatarImage
                                  src={result.avatar_url}
                                  alt={result.username || 'Avatar'}
                                />
                              ) : (
                                <AvatarFallback>
                                  {result.username?.charAt(0).toUpperCase() ||
                                    result.display_name?.charAt(0).toUpperCase() ||
                                    '?'}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <div className="text-xs text-gray-400">
                                {result.username}
                              </div>
                              <div className="text-sm font-semibold text-white">
                                {result.display_name}
                              </div>
                            </div>
                          </div>
                          <UserIcon className="h-4 w-4 text-gray-400" />
                        </li>
                      ) : (
                        renderRoomSearchResult(result as Room & { isMember: boolean })
                      )
                    )}
                  </ul>
                </div>
              )}
              {!isLoading && searchResults.length === 0 && searchQuery.length > 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  Showing all {searchType}...
                </p>
              )}
              {!isLoading && !searchType && (
                <p className="text-sm text-gray-400 mt-2">
                  Select a search type to begin.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {user ? (
          <Button onClick={handleLogout} variant="ghost" size="sm">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        ) : (
          <Button onClick={handleLoginWithGithub} variant="ghost" size="sm">
            Login
          </Button>
        )}
      </div>
    </header>
  );
}
