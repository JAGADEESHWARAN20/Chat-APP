"use client";

import React, {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { Users, LockIcon, Settings, LogOut, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { useDebounce } from "use-debounce";
import { useRouter } from "next/navigation";

import { fetchAllUsers } from "@/lib/store/room.store"; // keep this util
import { useRoomStore } from "@/lib/store/room.store";

// User type
type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

// UUID validator
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SearchComponent = memo(function SearchComponent({ user }: any) {
  const router = useRouter();

  /* ------------------------------
    Local search state
  ------------------------------ */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users">("rooms");
  const [isLoading, setIsLoading] = useState(false);
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 400);
  const isMounted = useRef(true);

  /* ------------------------------
    Zustand global room store
  ------------------------------ */
  const rooms = useRoomStore((s) => s.rooms);
  const presence = useRoomStore((s) => s.presence);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);

  /* ------------------------------
    Mount/unmount guard
  ------------------------------ */
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /* ------------------------------
    Search input handler
  ------------------------------ */
  const handleSearchInputChange = useCallback((e: any) => {
    setSearchQuery(e.target.value);
  }, []);

  /* ------------------------------
    Fetch user results (debounced)
  ------------------------------ */
  const fetchUserResults = useCallback(async () => {
    if (searchType !== "users") return;

    if (!user?.id) {
      setUserResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const all = await fetchAllUsers();

      if (!isMounted.current) return;

      if (!debouncedSearchQuery.trim()) {
        setUserResults(all);
      } else {
        const q = debouncedSearchQuery.toLowerCase();
        setUserResults(
          all.filter(
            (u) =>
              u.username?.toLowerCase().includes(q) ||
              u.display_name?.toLowerCase().includes(q)
          )
        );
      }
    } catch (err) {
      toast.error("Failed to fetch users");
      setUserResults([]);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [debouncedSearchQuery, searchType, user?.id]);

  /* ------------------------------
    Trigger user search
  ------------------------------ */
  useEffect(() => {
    if (searchType === "users") {
      fetchUserResults();
    } else {
      setUserResults([]);
    }
  }, [searchType, debouncedSearchQuery, fetchUserResults]);

  /* ------------------------------
    Room search results
  ------------------------------ */
  const roomResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return rooms;

    const q = debouncedSearchQuery.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(q));
  }, [rooms, debouncedSearchQuery]);

  /* ------------------------------
    Join room
  ------------------------------ */
  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      if (!UUID_REGEX.test(roomId)) {
        toast.error("Invalid room ID");
        return;
      }
      const ok = await joinRoom(roomId);
      if (!ok) toast.error("Failed to join room");
    },
    [joinRoom]
  );

  /* ------------------------------
    Room card renderer
  ------------------------------ */
  const renderRoomCard = useCallback(
    (room: any) => {
      const online = presence[room.id]?.onlineUsers ?? 0;

      return (
        <div
          key={room.id}
          className="p-4 rounded-lg border bg-card hover:bg-accent transition shadow-sm"
        >
          <div className="flex justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-600 font-bold">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1 text-lg font-semibold">
                  #{room.name}
                  {room.is_private && (
                    <LockIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {room.memberCount} members • {online} online
                </div>
              </div>
            </div>
          </div>

          {/* --- ACTIONS --- */}
          {room.isMember ? (
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => router.push(`/rooms/${room.id}/settings`)}
                size="sm"
              >
                <Settings className="h-4 w-4 mr-1" /> Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500"
                onClick={() => leaveRoom(room.id)}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Leave
              </Button>
            </div>
          ) : room.participationStatus === "pending" ? (
            <div className="text-yellow-500 text-sm font-medium bg-yellow-500/10 p-2 rounded-md text-center">
              Request Pending
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => handleJoinRoom(room.id)}
            >
              Join Room
            </Button>
          )}
        </div>
      );
    },
    [router, leaveRoom, presence, handleJoinRoom]
  );

  return (
    <div className="w-full max-w-[420px] mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-xl">Search</h3>
        <Button variant="ghost" size="icon" onClick={() => router.push("/profile")}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <Input
        placeholder={searchType === "users" ? "Search users..." : "Search rooms..."}
        value={searchQuery}
        onChange={handleSearchInputChange}
        className="mb-4"
      />

      <Tabs defaultValue={searchType} onValueChange={(v) => setSearchType(v as any)}>
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* ROOMS */}
        <TabsContent value="rooms">
          <div className="grid gap-3 overflow-y-auto max-h-[450px]">
            {roomResults.length > 0 ? (
              roomResults.map(renderRoomCard)
            ) : (
              <div className="text-center text-muted-foreground p-4 border rounded">
                No rooms found
              </div>
            )}
          </div>
        </TabsContent>

        {/* USERS */}
        <TabsContent value="users">
          <ul className="space-y-3 overflow-y-auto max-h-[450px]">
            {isLoading ? (
              <div className="text-center text-muted-foreground p-2">Loading...</div>
            ) : userResults.length > 0 ? (
              userResults.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar_url ?? ""} />
                      <AvatarFallback>{u.username?.[0] ?? "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm text-muted-foreground">{u.username}</div>
                      <div className="text-base">{u.display_name}</div>
                    </div>
                  </div>
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </li>
              ))
            ) : (
              <div className="text-center text-muted-foreground p-2">No users found</div>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default SearchComponent;
