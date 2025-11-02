"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Button } from "./ui/button";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Settings, UserIcon, LockIcon, LogOut, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useRoomContext, RoomWithMembershipCount } from "@/lib/store/RoomContext";
import { useDebounce } from "use-debounce";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomActiveUsers } from "@/components/reusable/RoomActiveUsers";

// Limited type for fetched profiles (matches select fields)
type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

// ✅ UUID regex for frontend validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SearchComponent = memo(function SearchComponent({
  user,
}: {
  user: SupabaseUser | undefined;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFaded, setIsFaded] = useState(false);
  
  const isMounted = useRef(true);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  
  // ✅ Use optimized RoomContext
  const { state, joinRoom, leaveRoom, fetchAllUsers, getRoomPresence } = useRoomContext();
  const { availableRooms, isLoading: roomsLoading } = state;

  // Fade effect
  useEffect(() => {
    const timer = setTimeout(() => setIsFaded(true), 2);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Search input handler
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    []
  );

  // User search with optimization
  const fetchUserResults = useCallback(async () => {
    if (searchType !== "users" || !user?.id) {
      setIsLoading(false);
      setUserResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const users = await fetchAllUsers();
      if (isMounted.current) {
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
  }, [searchType, user?.id, debouncedSearchQuery, fetchAllUsers]);

  // User search effect
  useEffect(() => {
    if (searchType === "users") {
      fetchUserResults();
    }
  }, [searchType, debouncedSearchQuery, fetchUserResults]);

  // Optimized room results with proper filtering
  const roomResults = useMemo(() => {
    if (roomsLoading && availableRooms.length === 0) {
      return [];
    }
    
    if (!debouncedSearchQuery.trim()) {
      return availableRooms.filter(room => room.id);
    }
    
    const q = debouncedSearchQuery.toLowerCase();
    return availableRooms.filter((room) => 
      room.id && room.name.toLowerCase().includes(q)
    );
  }, [availableRooms, debouncedSearchQuery, roomsLoading]);

  // Optimized join room handler
  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      // Validate room ID
      if (!roomId || roomId === 'undefined' || !UUID_REGEX.test(roomId)) {
        console.error("❌ Invalid room ID:", roomId);
        toast.error("Invalid room ID. Try refreshing the list.");
        return;
      }

      if (!user?.id) {
        toast.error("You must be logged in to join a room");
        return;
      }

      try {
        await joinRoom(roomId);
      } catch (error) {
        console.error("Join room error:", error);
        const errorMsg = (error as Error).message || "Failed to join room";
        if (errorMsg.includes('debug')) {
          console.log('API Debug Info:', error);
        }
        toast.error(errorMsg);
      }
    },
    [user?.id, joinRoom]
  );

  // Optimized room result renderer
  const renderRoomSearchResult = useCallback((result: RoomWithMembershipCount) => {
    if (!result.id) return null;

    // ✅ Get real-time presence data
    const { onlineUsers } = getRoomPresence(result.id);

    return (
      <div
        key={result.id}
        className="flex flex-col p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all hover:shadow-md"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/30 flex-shrink-0">
              <span className="text-xl font-semibold text-indigo-400">
                {result.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-lg text-foreground truncate">
                  #{result.name}
                </span>
                {result.is_private && (
                  <LockIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {result.memberCount || 0} {result.memberCount === 1 ? "member" : "members"}
                </span>
                {/* ✅ Use real-time active users */}
                {onlineUsers > 0 && (
                  <span className="text-green-600 dark:text-green-400 ml-1 font-medium">
                    • {onlineUsers} online
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {result.isMember ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push(`/rooms/${result.id}/settings`)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => leaveRoom(result.id)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
                title="Leave Room"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave
              </Button>
            </>
          ) : result.participationStatus === "pending" ? (
            <span className="text-sm text-yellow-500 dark:text-yellow-400 font-medium px-3 py-1 bg-yellow-500/10 rounded-md">
              Pending Request
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => handleJoinRoom(result.id)}
              disabled={!user}
              className="bg-indigo-500 text-white hover:bg-indigo-600 transition-colors w-full"
            >
              Join Room
            </Button>
          )}
        </div>
      </div>
    );
  }, [router, user, handleJoinRoom, leaveRoom, getRoomPresence]);

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
            : "Search rooms..."
        }
        value={searchQuery}
        onChange={handleSearchInputChange}
        className="mb-4 bg-muted/50 border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
      />
      
      <Tabs
        defaultValue={searchType}
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
            <div className="grid gap-3 overflow-y-auto max-h-[440px] py-[0.2em] rounded-lg scrollbar-none lg:scrollbar-custom">
              {showLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col p-4 rounded-lg border border-border bg-card animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-12 w-12 rounded-lg bg-accent" />
                      <div className="flex-1">
                        <div className="h-5 w-32 bg-accent rounded mb-2" />
                        <div className="h-4 w-24 bg-accent rounded" />
                      </div>
                    </div>
                    <div className="h-8 w-full bg-accent rounded" />
                  </div>
                ))
              ) : roomResults.length > 0 ? (
                roomResults.map((result) => renderRoomSearchResult(result))
              ) : (
                <div className="text-[1em] text-muted-foreground p-4 text-center border border-border rounded-lg bg-card">
                  {debouncedSearchQuery ? "No rooms found" : "No rooms available"}
                </div>
              )}
            </div>
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
                          <AvatarImage src={result.avatar_url} alt={result.username || "Avatar"} />
                        ) : (
                          <AvatarFallback className="bg-indigo-500 text-white">
                            {result.username?.charAt(0).toUpperCase() || result.display_name?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="text-xs text-muted-foreground">{result.username}</div>
                        <div className="text-[1em] font-medium text-black dark:text-white">
                          {result.display_name}
                        </div>
                      </div>
                    </div>
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </li>
                ))
              ) : (
                <li className="text-[1em] text-muted-foreground p-2 text-center">
                  {debouncedSearchQuery ? "No users found" : "Search for users to see results"}
                </li>
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
});

export default SearchComponent;