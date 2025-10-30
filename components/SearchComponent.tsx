"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Settings, UserIcon, LockIcon, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Database } from "@/lib/types/supabase";
import { toast } from "sonner";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useDebounce } from "use-debounce";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Limited type for fetched profiles (matches select fields)
type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

// ✅ ADD: UUID regex for frontend validation (matches API)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SearchComponent({
  user,
}: {
  user: SupabaseUser | undefined;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isFaded, setIsFaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsFaded(true), 2);
    return () => clearTimeout(timer);
  }, []);
  // debounce the searchQuery for filtering
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  // ✅ Use global state from context
  const { state, joinRoom, leaveRoom, fetchAvailableRooms, fetchAllUsers } = useRoomContext();
  const { availableRooms, isLoading: roomsLoading } = state;
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // update the searchQuery; debouncedSearchQuery will update after 300ms
      setSearchQuery(e.target.value);
    },
    []
  );
  const fetchUserResults = useCallback(async () => {
    if (searchType !== "users" || !user) {
      setIsLoading(false);
      setUserResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const users = await fetchAllUsers();
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        const filteredUsers = users.filter(
          (u) =>
            u.username?.toLowerCase().includes(q) ||
            u.display_name?.toLowerCase().includes(q)
        );
        setUserResults(filteredUsers);
      } else {
        setUserResults(users);
      }
    } catch (error) {
      console.error("User search error:", error);
      if (isMounted.current) {
        toast.error(
          error instanceof Error ? error.message : "An error occurred while searching users"
        );
        setUserResults([]);
      }
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [searchType, user, debouncedSearchQuery, fetchAllUsers]);
  useEffect(() => {
    if (searchType === "users") {
      fetchUserResults();
    }
  }, [searchType, fetchUserResults]);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  const roomResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return availableRooms.filter(room => room.id); // ✅ FIX: Filter out invalid rooms (no id)
    }
    const q = debouncedSearchQuery.toLowerCase();
    return availableRooms.filter((room) => room.id && room.name.toLowerCase().includes(q)); // ✅ FIX: Ensure valid id + search
  }, [availableRooms, debouncedSearchQuery]);
 
  
 
  const handleJoinRoom = useCallback(
  async (roomId: string) => {
    console.log("handleJoinRoom called with roomId:", roomId);
    // Validate room ID with UUID regex
    if (!roomId || roomId === 'undefined' || !UUID_REGEX.test(roomId)) {
      console.error("❌ Invalid room ID in handleJoinRoom:", roomId);
      toast.error("Invalid room ID. Try refreshing the list.");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to join a room");
      return;
    }

    console.log("Attempting to join room:", roomId);
    try {
      await joinRoom(roomId);
      await fetchAvailableRooms();
    } catch (error) {
      console.error("Join room error:", error);
      const errorMsg = (error as Error).message || "Failed to join room";
      // Handle API debug info if present
      if (errorMsg.includes('debug')) {
        console.log('API Debug Info:', error);
      }
      toast.error(errorMsg);
    }
  },
  [user, joinRoom, fetchAvailableRooms]
);
  const renderRoomSearchResult = (result: RoomWithMembershipCount) => (
    // ✅ FIX: Early guard - skip render if invalid result (prevents bad onClick)
    !result.id ? null : (
      <li
        key={result.id}
        className="flex items-center justify-between pb-[1em] rounded-lg transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/30">
            <span className="text-lg font-semibold text-indigo-400">
              {result.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-black dark:text-white">{result.name}</span>
              {result.is_private && <LockIcon className="h-3.5 w-3.5 text-gray-400" />}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {result.memberCount} {result.memberCount === 1 ? "member" : "members"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result.isMember ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push(`/rooms/${result.id}/settings`)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => leaveRoom(result.id)}
                className="bg-red-500 hover:bg-red-600 rounded-md text-white"
                title="Leave Room"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : result.participationStatus === "pending" ? (
            <span className="text-sm text-yellow-500 dark:text-yellow-400 font-medium">Pending</span>
          ) : (
            <Button
              size="sm"
              onClick={() => handleJoinRoom(result.id)}
              disabled={!user}
              className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
            >
              Join
            </Button>
          )}
        </div>
      </li>
    )
  );
  const showLoading = isLoading || (searchType === "rooms" && roomsLoading);
  return (
    <div className="w-full max-w-[400px] mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-[1.5em]">Search</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/profile")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      <Input
        type="text"
        placeholder={
          searchType === "users"
            ? "Search users..."
            : searchType === "rooms"
            ? "Search rooms..."
            : "Search..."
        }
        value={searchQuery}
        onChange={handleSearchInputChange}
        className="mb-4 bg-muted/50 border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
      />
      <Tabs
        defaultValue={searchType || "rooms"}
        onValueChange={(value) => setSearchType(value as "rooms" | "users")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="rooms">
          <div className="mt-4">
            <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">Rooms</h4>
            <ul className="space-y-[0.1em] overflow-y-auto max-h-[440px] py-[0.2em] rounded-lg scrollbar-none lg:scrollbar-custom">
              {showLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent" />
                      <div>
                        <div className="h-4 w-32 bg-accent rounded mb-2" />
                        <div className="h-3 w-24 bg-accent rounded" />
                      </div>
                    </div>
                    <div className="h-8 w-16 bg-accent rounded" />
                  </li>
                ))
              ) : roomResults.length > 0 ? (
                roomResults.map((result) => renderRoomSearchResult(result))
              ) : (
                <li className="text-[1em] text-muted-foreground p-2 text-center">
                  {debouncedSearchQuery ? "No rooms found" : "No rooms available"}
                </li>
              )}
            </ul>
          </div>
        </TabsContent>
        <TabsContent value="users">
          <div className="mt-4">
            <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">User Profiles</h4>
            <ul className="space-y-3 overflow-y-auto max-h-[440px] scrollbar-none lg:scrollbar-custom">
              {showLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent" />
                      <div>
                        <div className="h-4 w-24 bg-accent rounded mb-2" />
                        <div className="h-3 w-16 bg-accent rounded" />
                      </div>
                    </div>
                    <div className="h-6 w-6 bg-accent rounded" />
                  </li>
                ))
              ) : userResults.length > 0 ? (
                userResults.map((result) => (
                  <li key={result.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {result.avatar_url ? (
                          <AvatarImage src={result.avatar_url} alt={result.username || "Avatar"} className="rounded-full" />
                        ) : (
                          <AvatarFallback className="bg-indigo-500 text-white rounded-full">
                            {result.username?.charAt(0).toUpperCase() || result.display_name?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="text-xs text-muted-foreground">{result.username}</div>
                        <div className="text-[1em] font-medium text-black dark:text-white">{result.display_name}</div>
                      </div>
                    </div>
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </li>
                ))
              ) : (
                <li className="text-[1em] text-muted-foreground p-2 text-center">{debouncedSearchQuery ? "No users found" : "Search for users to see results"}</li>
              )}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
      {searchQuery.length === 0 && searchType && (
        <p className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${isFaded ? "opacity-0" : "opacity-100"}`}>
          Showing all {searchType}...
        </p>
      )}
      {showLoading && (
        <p className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${isFaded ? "opacity-0" : "opacity-100"}`}>
          Loading...
        </p>
      )}
    </div>
  );
}