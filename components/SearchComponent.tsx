"use client";

import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import {
  Users as UsersIcon,
  Lock as LockIcon,
  Search as SearchIcon,
  LogOut,
} from "lucide-react";

import { useRoomPresence, useAvailableRooms, useRoomActions, type RoomWithMembership } from "@/lib/store/roomstore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

interface RealtimePayload {
  eventType: string;
  new: any;
  old: any;
}

interface NotificationPayload {
  new?: {
    type?: string;
    room_id?: string;
  };
}

const highlight = (text: string, q: string) => {
  if (!q) return text;
  const pos = text.toLowerCase().indexOf(q.toLowerCase());
  if (pos === -1) return text;

  return (
    <>
      {text.slice(0, pos)}
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-1 rounded-sm">
        {text.slice(pos, pos + q.length)}
      </span>
      {text.slice(pos + q.length)}
    </>
  );
};

const SearchComponent = memo(function SearchComponent({
  user,
}: {
  user: PartialProfile | null | undefined;
}) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const [debounced] = useDebounce(query, 300);

  // Use unified store
  const presence = useRoomPresence();
  const availableRooms = useAvailableRooms();
  const { joinRoom, leaveRoom, refreshRooms } = useRoomActions();

  // Debug: Log when availableRooms changes
  useEffect(() => {
    console.log('🔍 SearchComponent - availableRooms updated:', {
      totalRooms: availableRooms.length,
      joinedRooms: availableRooms.filter(r => r.isMember && r.participationStatus === 'accepted').length,
      pendingRooms: availableRooms.filter(r => r.participationStatus === 'pending').length
    });
  }, [availableRooms]);

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      console.log('🔍 SearchComponent - Initial data load for user:', user.id);
      refreshRooms().catch(console.error);
    }
  }, [user?.id, refreshRooms]);

  // Filter rooms based on search
  const filteredRooms = useMemo(() => {
    if (!debounced) return availableRooms;
    return availableRooms.filter(room => 
      room.name.toLowerCase().includes(debounced.toLowerCase())
    );
  }, [availableRooms, debounced]);

  // Real-time subscription for membership updates
  useEffect(() => {
    if (!user?.id) {
      console.log('❌ SearchComponent - No user ID, skipping realtime setup');
      return;
    }

    console.log('🔌 SearchComponent - Setting up realtime subscriptions for user:', user.id);
    const channel = supabase.channel(`search-sync-${user.id}`);

    const subscribe = async () => {
      try {
        // Listen for room participant changes
        channel.on(
          "postgres_changes",
          { 
            event: "*", 
            schema: "public", 
            table: "room_participants",
            filter: `user_id=eq.${user.id}`
          },
          async (payload: RealtimePayload) => {
            console.log('📢 SearchComponent - room_participants event:', payload);
            try {
              const { eventType, new: newRecord, old: oldRecord } = payload;
              const record = newRecord || oldRecord;
              
              if (!record?.room_id) {
                console.log('❌ No room_id in payload');
                return;
              }

              console.log('🔄 Processing participant change for room:', record.room_id, 'status:', newRecord?.status);

              // Refresh rooms when participation status changes
              if (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE') {
                console.log('🔄 Refreshing rooms due to participant change');
                await refreshRooms();
                
                if (eventType === 'UPDATE' && newRecord?.status === 'accepted') {
                  console.log('🎉 User accepted into room:', record.room_id);
                  toast.success("Your request was accepted! You can now access the room.");
                }
              }
            } catch (error) {
              console.error('❌ Error handling participant update:', error);
            }
          }
        );

        // Listen for notifications
        channel.on(
          "postgres_changes",
          { 
            event: "*", 
            schema: "public", 
            table: "notifications",
            filter: `user_id=eq.${user.id}`
          },
          async (payload: NotificationPayload) => {
            console.log('📢 SearchComponent - notifications event:', payload);
            try {
              const { new: newRecord } = payload;
              
              if (newRecord?.type === 'join_request_accepted' && newRecord.room_id) {
                console.log('🎉 Join request accepted for room:', newRecord.room_id);
                // Refresh to show the user they're now a member
                await refreshRooms();
                toast.success("Your join request was accepted!");
              }
            } catch (error) {
              console.error('❌ Error handling notification update:', error);
            }
          }
        );

        await channel.subscribe();
        console.log('✅ SearchComponent - Realtime subscriptions active');
      } catch (err) {
        console.error('❌ SearchComponent - Subscription error:', err);
      }
    };

    subscribe();

    return () => {
      console.log('🔌 SearchComponent - Cleaning up realtime subscriptions');
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [supabase, user?.id, refreshRooms]);

  // Fetch users when tab changes to users
  const fetchUsersRPC = useCallback(async () => {
    if (tab !== "users") return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_users", {
        p_query: debounced || "",
      });

      if (error) throw error;
      setUserResults(data || []);
    } catch (err) {
      console.error("fetchUsersRPC error:", err);
      toast.error("Failed loading users");
    } finally {
      setLoading(false);
    }
  }, [supabase, debounced, tab]);

  useEffect(() => {
    if (tab === "users") {
      fetchUsersRPC();
    }
  }, [tab, fetchUsersRPC]);

  const handleJoin = useCallback(async (roomId: string) => {
    console.log('🔍 SearchComponent - Joining room:', roomId);
    const success = await joinRoom(roomId);
    if (success) {
      console.log('✅ SearchComponent - Join request successful');
      // The store will handle optimistic updates and real-time sync
    } else {
      console.log('❌ SearchComponent - Join request failed');
    }
  }, [joinRoom]);

  const handleLeave = useCallback(async (roomId: string) => {
    console.log('🔍 SearchComponent - Leaving room:', roomId);
    const success = await leaveRoom(roomId);
    if (success) {
      console.log('✅ SearchComponent - Leave request successful');
      // Store handles the state updates
    } else {
      console.log('❌ SearchComponent - Leave request failed');
    }
  }, [leaveRoom]);

  const RoomCard = ({ room }: { room: RoomWithMembership }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;
    const isMember = room.isMember && room.participationStatus === 'accepted';
    const isPending = room.participationStatus === 'pending';

    console.log('🔍 RoomCard rendering:', {
      id: room.id,
      name: room.name,
      isMember,
      isPending,
      participationStatus: room.participationStatus
    });

    return (
      <Card className="flex flex-col h-full rounded-2xl bg-card/80 border shadow-sm hover:shadow-md transition-all">
        <CardHeader className="h-20 p-4 bg-gradient-to-br from-indigo-600/20 to-indigo-800/40 rounded-t-2xl">
          <p className="text-base md:text-lg font-semibold flex items-center gap-2 truncate">
            #{highlight(room.name, debounced)}
            {room.is_private && <LockIcon className="h-4 w-4 text-muted-foreground" />}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col justify-between flex-1 p-4">
          <div className="space-y-2 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{room.memberCount} members</span>

              {online > 0 && (
                <span className="flex items-center gap-1 text-green-500 ml-2 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  {online} online
                </span>
              )}
            </div>

            {isPending && (
              <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded-md">
                Pending approval
              </span>
            )}
            
            {isMember && (
              <span className="text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded-md">
                Member
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {isMember ? (
              <>
                <Button 
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-700" 
                  onClick={() => router.push(`/rooms/${room.id}`)}
                >
                  Open Room
                </Button>

                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700" 
                  onClick={() => handleLeave(room.id)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white" 
                onClick={() => handleJoin(room.id)}
                disabled={isPending}
              >
                {isPending ? "Request Sent" : "Join Room"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const UserCard = (u: PartialProfile) => {
    const initial = (u.display_name ?? u.username ?? "?")[0]?.toUpperCase();

    return (
      <Card className="flex flex-col items-center justify-between p-4 rounded-xl bg-card/80 border aspect-[3/4]">
        <Avatar className="h-16 w-16 rounded-xl mb-3">
          {u.avatar_url ? (
            <AvatarImage src={u.avatar_url} alt={u.display_name ?? "User"} />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-lg">
              {initial}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="text-center">
          <p className="font-semibold text-sm md:text-base truncate">
            {highlight(u.display_name ?? u.username ?? "Unknown", debounced)}
          </p>
          <p className="text-xs text-muted-foreground">@{u.username}</p>
        </div>

        <Button 
          size="sm" 
          variant="secondary" 
          className="w-full mt-3" 
          onClick={() => router.push(`/profile/${u.id}`)}
        >
          View
        </Button>
      </Card>
    );
  };

  return (
    <div className="w-full mx-auto p-4 md:p-6 h-full flex flex-col overflow-hidden">
      {/* Search bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Input 
            className="pl-10 h-12 rounded-xl" 
            placeholder="Search rooms or users…" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results */}
      <div className="flex-1 h-[80vh] overflow-y-scroll">
        <AnimatePresence mode="wait">
          {tab === "rooms" && (
            <motion.div key="rooms" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading ? (
                <div className="h-full flex items-center justify-center">Loading…</div>
              ) : filteredRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {debounced ? "No rooms found" : "No rooms available"}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-2">
                  {filteredRooms.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading ? (
                <div className="h-full flex items-center justify-center">Loading…</div>
              ) : userResults.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No users found
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 p-2">
                  {userResults.map((u) => (
                    <UserCard key={u.id} {...u} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

SearchComponent.displayName = "SearchComponent";
export default SearchComponent;