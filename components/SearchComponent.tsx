"use client";

import React, {
  memo,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  useAvailableRooms,
  useRoomActions,
  useRoomPresence,
  fetchAllUsers,
  useRoomRealtimeSync, // 🎯 ADD THIS IMPORT
} from "@/lib/store/roomstore";

import { useDebounce } from "use-debounce";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user"; // 🎯 ADD THIS IMPORT

import { Users, Lock, Search } from "lucide-react";

/* ---------------------------------------------------------
   UTIL: highlight search text
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   USER CARD
--------------------------------------------------------- */
const UserCard = memo(function UserCard({
  user,
  query,
  onOpenDM,
}: {
  user: any;
  query: string;
  onOpenDM: (id: string) => void;
}) {
  return (
    <div className="flex flex-col bg-card/80 w-[30vw] h-[28vh] rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-purple-600/20 to-purple-800/40">
        <p className="font-semibold truncate flex items-center gap-2">
          @{highlight(user.username || user.display_name, query)}
        </p>
      </div>

      <div className="flex flex-col justify-between p-4 flex-1">
        <div className="space-y-1 text-sm">
          <span className="text-xs opacity-70">
            Joined at: {new Date(user.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-3">
          <Button size="sm" onClick={() => onOpenDM(user.id)}>
            Message
          </Button>
        </div>
      </div>
    </div>
  );
});

/* ---------------------------------------------------------
   ROOM CARD
--------------------------------------------------------- */
const RoomCard = memo(function RoomCard({
  room,
  query,
  presence,
  onJoin,
  onLeave,
  onOpen,
}: {
  room: any;
  query: string;
  presence: any;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const online = presence?.[room.id]?.onlineUsers ?? 0;
  const isMember = room.isMember && room.participationStatus === "accepted";
  const isPending = room.participationStatus === "pending";

  return (
    <div className="flex flex-col bg-card/80 w-[30vw] h-[40vh] rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-indigo-600/20 to-indigo-800/40">
        <p className="font-semibold truncate flex items-center gap-2">
          #{highlight(room.name, query)}
          {room.is_private && <Lock className="h-4 w-4 opacity-50" />}
        </p>
      </div>

      <div className="flex flex-col justify-between p-4 flex-1">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 opacity-60" />
            <span className="font-medium">{room.memberCount}</span>

            {online > 0 && (
              <span className="text-green-500 text-xs flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
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

        <div className="mt-3 flex flex-col gap-2">
          {isMember ? (
            <>
              <Button size="sm" onClick={() => onOpen(room.id)}>
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600"
                onClick={() => onLeave(room.id)}
              >
                Leave
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={isPending} onClick={() => onJoin(room.id)}>
              {isPending ? "Requested" : "Join"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

/* ---------------------------------------------------------
   MAIN COMPONENT — FIXED REAL-TIME UPDATES
--------------------------------------------------------- */
export default function SearchComponent({ user }: any) {
  const router = useRouter();
  const authUser = useUser();
  
  const availableRooms = useAvailableRooms();
  const presence = useRoomPresence();
  const { joinRoom, leaveRoom, updateRoomMembership, fetchRooms } = useRoomActions();

  // 🎯 USE THE REAL-TIME SYNC HOOK
  useRoomRealtimeSync(authUser?.user?.id || null);

  // 🎯 ADD THIS NEW EFFECT FOR DIRECT REAL-TIME UPDATES
  useEffect(() => {
    if (!authUser?.user?.id) return;
    
    const supabase = getSupabaseBrowserClient();
    
    const directChannel = supabase.channel('search-direct-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `user_id=eq.${authUser.user.id}`
        },
        (payload) => {
          console.log('🎯 Direct room membership detected in SearchComponent');
          fetchRooms({ force: true });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${authUser.user.id}`
        },
        (payload) => {
          if (payload.new.type === 'join_request_accepted') {
            console.log('🎯 Join accepted notification in SearchComponent');
            fetchRooms({ force: true });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE', 
          schema: 'public',
          table: 'notifications', 
          filter: `user_id=eq.${authUser.user.id}`
        },
        (payload) => {
          console.log('🗑️ Notification deleted - might be join request acceptance');
          // Refresh rooms in case this was an accept action
          setTimeout(() => fetchRooms({ force: true }), 100);
        }
      )
      .subscribe((status) => {
        console.log('🔔 SearchComponent direct channel status:', status);
      });

    return () => {
      supabase.removeChannel(directChannel);
    };
  }, [authUser?.user?.id, fetchRooms]);
  
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("rooms");
  const [users, setUsers] = useState<any[]>([]);
  const [debounced] = useDebounce(query, 250);

  /* ---------------------------------------------------------
     FETCH USERS WHEN TAB SWITCHES
  --------------------------------------------------------- */
  useEffect(() => {
    if (activeTab !== "users") return;
    fetchAllUsers().then(setUsers);
  }, [activeTab]);

  /* ---------------------------------------------------------
     ROOM FILTER
  --------------------------------------------------------- */
  const filteredRooms = useMemo(() => {
    if (!debounced) return availableRooms;
    const q = debounced.toLowerCase();
    return availableRooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [availableRooms, debounced]);

  /* ---------------------------------------------------------
     USER FILTER
  --------------------------------------------------------- */
  const filteredUsers = useMemo(() => {
    if (!debounced) return users;
    const q = debounced.toLowerCase();
    return users.filter((u) =>
      (u.username || u.display_name)?.toLowerCase().includes(q)
    );
  }, [users, debounced]);

  /* ---------------------------------------------------------
     HANDLERS
  --------------------------------------------------------- */
  const handleJoin = useCallback(
    async (roomId: string) => {
      updateRoomMembership(roomId, { participationStatus: "pending" });
      await joinRoom(roomId);
    },
    [joinRoom, updateRoomMembership]
  );

  const handleLeave = useCallback(
    async (roomId: string) => {
      updateRoomMembership(roomId, { isMember: false, participationStatus: null });
      await leaveRoom(roomId);
    },
    [leaveRoom, updateRoomMembership]
  );

  const handleOpenRoom = useCallback(
    (id: string) => router.push(`/rooms/${id}`),
    [router]
  );

  const handleOpenDM = useCallback(
    (id: string) => router.push(`/dm/${id}`),
    [router]
  );

  /* ---------------------------------------------------------
     UI
  --------------------------------------------------------- */
  return (
    <div className="w-full h-[90vh] p-4 flex flex-col overflow-hidden">

      {/* SEARCH BAR */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="pl-10 h-12 rounded-xl"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 opacity-50" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {activeTab === "rooms" && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                query={debounced}
                presence={presence}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onOpen={handleOpenRoom}
              />
            ))}
          </motion.div>
        )}

        {activeTab === "users" && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {filteredUsers.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                query={debounced}
                onOpenDM={handleOpenDM}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}