"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
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

import {
  useRoomActions,
  useRoomPresence,
} from "@/lib/store/RoomContext";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type RoomResult = {
  id: string;
  name: string;
  is_private: boolean;
  member_count: number;
  is_member: boolean;
  participation_status: string | null;
};

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
  user: PartialProfile;
}) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [roomResults, setRoomResults] = useState<RoomResult[]>([]);
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const [debounced] = useDebounce(query, 300);

  const presence = useRoomPresence();
  const { joinRoom, leaveRoom } = useRoomActions();

  // -------------------------------------------------------------------
  // RPC: search_rooms
  // -------------------------------------------------------------------
  const fetchRoomsRPC = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_rooms", {
        p_query: debounced || "",
      });

      if (error) throw error;
      setRoomResults(data || []);
    } catch (err) {
      toast.error("Failed loading rooms");
    } finally {
      setLoading(false);
    }
  }, [supabase, debounced]);

  // -------------------------------------------------------------------
  // RPC: search_users
  // -------------------------------------------------------------------
  const fetchUsersRPC = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_users", {
        p_query: debounced || "",
      });

      if (error) throw error;
      setUserResults(data || []);
    } catch (err) {
      toast.error("Failed loading users");
    } finally {
      setLoading(false);
    }
  }, [supabase, debounced]);

  // -------------------------------------------------------------------
  // TAB SWITCH / QUERY CHANGE
  // -------------------------------------------------------------------
  useEffect(() => {
    if (tab === "rooms") fetchRoomsRPC();
    if (tab === "users") fetchUsersRPC();
  }, [tab, debounced]);

  // -------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------
  const handleJoin = async (roomId: string) => {
    try {
      await joinRoom(roomId);
      fetchRoomsRPC();
    } catch (err) {
      toast.error("Failed to join room");
    }
  };

  const handleLeave = async (roomId: string) => {
    try {
      await leaveRoom(roomId);
      fetchRoomsRPC();
    } catch (err) {
      toast.error("Failed to leave room");
    }
  };

  // -------------------------------------------------------------------
  // ROOM CARD
  // -------------------------------------------------------------------
  const RoomCard = ({ room }: { room: RoomResult }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;

    return (
      <Card className="flex flex-col h-full min-h-[18rem] md:min-h-[20rem] min-w-[16rem] md:min-w-[22rem] rounded-2xl shadow-sm hover:shadow-md transition-all bg-card/80 border">
        <CardHeader className="h-20 bg-gradient-to-br from-indigo-600/20 to-indigo-800/40 p-4 rounded-t-2xl">
          <p className="text-base md:text-lg font-semibold truncate flex items-center gap-2">
            #{highlight(room.name, debounced)}
            {room.is_private && <LockIcon className="h-4 w-4 text-muted-foreground" />}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col justify-between flex-1 p-4">
          <div className="space-y-2 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{room.member_count} members</span>

              {online > 0 && (
                <span className="flex items-center gap-1 text-green-500 ml-2 text-xs md:text-sm font-medium">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  {online} online
                </span>
              )}
            </div>

            {room.participation_status === "pending" && (
              <span className="text-xs font-medium bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded-md">
                Pending approval
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {room.is_member ? (
              <>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
              >
                Join Room
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // -------------------------------------------------------------------
  // USER CARD
  // -------------------------------------------------------------------
  const UserCard = (u: PartialProfile) => {
    const first = (u.display_name ?? u.username ?? "?")[0]?.toUpperCase();

    return (
      <Card className="flex flex-col items-center justify-between p-4 rounded-xl aspect-[3/4] bg-card/80 border">
        <Avatar className="h-16 w-16 rounded-xl mb-3">
          {u.avatar_url ? (
            <AvatarImage src={u.avatar_url} alt={u.display_name ?? "User"} />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-lg">
              {first}
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

  // -------------------------------------------------------------------
  // MAIN UI
  // -------------------------------------------------------------------
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
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 h-[80vh] overflow-y-scroll">
        <AnimatePresence mode="wait">
          {/* ROOMS */}
          {tab === "rooms" && (
            <motion.div key="rooms" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading ? (
                <div className="h-full flex items-center justify-center">Loading…</div>
              ) : roomResults.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">No rooms</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-2">
                  {roomResults.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading ? (
                <div className="h-full flex items-center justify-center">Loading…</div>
              ) : userResults.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">No users</div>
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
