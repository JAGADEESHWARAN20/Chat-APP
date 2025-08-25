"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Settings,
  UserIcon,
  LockIcon,
  LogOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Database } from "@/lib/types/supabase";
import { toast } from "sonner";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDebounce } from "use-debounce";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];

// Extended Room type including memberCount, isMember, participationStatus
type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

export default function SearchComponent({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
  const [roomResults, setRoomResults] = useState<RoomWithMembershipCount[]>([]);
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const supabase = supabaseBrowser();
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const { selectedRoom, setSelectedRoom } = useRoomStore();
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);

  const [limit] = useState(100);
  const [offset] = useState(0);
  const [isFaded, setIsFaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFaded(true);
    }, 2);
    return () => clearTimeout(timer);
  }, []);

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const UUID_REGEX = useMemo(
    () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    []
  );

  // Check if current user is a member of given room
  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (error) {
        console.error("Error checking room membership:", error);
        return false;
      }
      return data && data.length > 0 && data[0].status === "accepted";
    },
    [user, supabase]
  );

  // Check participation status for a given room (can be accepted or pending)
  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (memberError) {
        console.error(
          "Error checking room membership for participation status:",
          memberError
        );
      }

      const { data: participantStatus, error: participantError } =
        await supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", user.id);

      if (participantError) {
        console.error(
          "Error checking room participation status:",
          participantError
        );
      }

      if (
        memberStatus &&
        memberStatus.length > 0 &&
        memberStatus[0].status === "accepted"
      ) {
        return "accepted";
      }
      if (
        participantStatus &&
        participantStatus.length > 0 &&
        participantStatus[0].status === "accepted"
      ) {
        return "accepted";
      }
      if (
        memberStatus &&
        memberStatus.length > 0 &&
        memberStatus[0].status === "pending"
      ) {
        return "pending";
      }
      if (
        participantStatus &&
        participantStatus.length > 0 &&
        participantStatus[0].status === "pending"
      ) {
        return "pending";
      }
      return null;
    },
    [user, supabase]
  );

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debouncedCallback(e.target.value);
    },
    [debouncedCallback]
  );

  const fetchSearchResults = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setRoomResults([]);
      setUserResults([]);
      return;
    }

    if (!searchType) return;
    setIsLoading(true);
    try {
      if (searchType === "rooms") {
        const apiQuery = debouncedSearchQuery.trim()
          ? `?q=${encodeURIComponent(
              debouncedSearchQuery.trim()
            )}&limit=${limit}&offset=${offset}`
          : `?limit=${limit}&offset=${offset}`;
        const response = await fetch(`/api/rooms/all${apiQuery}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { rooms: fetchedRooms } = await response.json();

        if (isMounted.current) {
          // Get member counts for all rooms from both tables
          const roomIds = fetchedRooms.map((room: Room) => room.id);

          // Get accepted room members
          const { data: membersData } = await supabase
            .from("room_members")
            .select("room_id, user_id")
            .in("room_id", roomIds)
            .eq("status", "accepted");

          // Get accepted room participants
          const { data: participantsData } = await supabase
            .from("room_participants")
            .select("room_id, user_id")
            .in("room_id", roomIds)
            .eq("status", "accepted");

          // Combine both sets of users and count unique users per room
          const memberCounts = new Map<string, Set<string>>();

          // Add members
          membersData?.forEach((m: Pick<RoomMemberRow, "room_id" | "user_id">) => {
            if (!memberCounts.has(m.room_id)) {
              memberCounts.set(m.room_id, new Set());
            }
            memberCounts.get(m.room_id)!.add(m.user_id);
          });

          // Add participants
          participantsData?.forEach((p: { room_id: string; user_id: string }) => {
            if (!memberCounts.has(p.room_id)) {
              memberCounts.set(p.room_id, new Set());
            }
            memberCounts.get(p.room_id)!.add(p.user_id);
          });

          const roomsWithDetailedStatus = await Promise.all(
            fetchedRooms.map(async (room: Room) => ({
              ...room,
              participationStatus: await checkRoomParticipation(room.id),
              memberCount: memberCounts.get(room.id)?.size ?? 0,
              isMember: await checkRoomMembership(room.id),
            }))
          );
          setRoomResults(roomsWithDetailedStatus);
        }
      } else if (searchType === "users") {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, created_at")
          .ilike("display_name", `%${debouncedSearchQuery.trim()}%`)
          .limit(10);

        if (error) {
          console.error(`Search error for ${searchType}:`, error);
          toast.error(error.message || `Failed to search ${searchType}`);
          setUserResults([]);
        } else if (data && isMounted.current) {
          setUserResults(data);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      if (isMounted.current) {
        toast.error(
          error instanceof Error ? error.message : "An error occurred while searching"
        );
        setRoomResults([]);
        setUserResults([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    supabase,
    user,
    debouncedSearchQuery,
    checkRoomParticipation,
    checkRoomMembership,
    limit,
    offset,
    searchType,
  ]);

  const handleJoinRoom = useCallback(
    async (roomId?: string) => {
      if (!user) {
        toast.error("You must be logged in to join a room");
        return;
      }
      const currentRoomId = roomId || selectedRoom?.id;
      if (!currentRoomId) {
        toast.error("No room selected");
        return;
      }
      if (!UUID_REGEX.test(currentRoomId)) {
        toast.error("Invalid room ID format");
        return;
      }
      try {
        const response = await fetch(`/api/rooms/switch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId: currentRoomId }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.code === "AUTH_REQUIRED") {
            toast.error("Authentication required to join rooms.");
          } else if (result.code === "ROOM_NOT_FOUND") {
            toast.error("Room not found.");
          } else if (result.status === "pending") {
            toast.info(
              result.message || "Join request sent to room owner for approval."
            );
          } else {
            toast.error(result.message || "Failed to join room.");
          }
          return;
        }

        let newParticipationStatus: string | null = "accepted";
        let newIsMember = true;

        if (result.status === "pending") {
          newParticipationStatus = "pending";
          newIsMember = false;
        }

        const { data: room } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", currentRoomId)
          .single();
        if (!room) {
          throw new Error("Failed to fetch room details after join.");
        }

        // Member count unknown at this point, you may fetch or set as 0 and refresh elsewhere
        const roomWithMembership: RoomWithMembershipCount = {
          ...room,
          isMember: newIsMember,
          participationStatus: newParticipationStatus,
          memberCount: 0,
        };

        setSelectedRoom(roomWithMembership);
        if (searchType) {
          await fetchSearchResults();
        }
        toast.success(result.message || "Joined room successfully");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to join room");
      }
    },
    [
      user,
      selectedRoom,
      UUID_REGEX,
      setSelectedRoom,
      supabase,
      searchType,
      fetchSearchResults,
    ]
  );

  const handleSearchByType = (type: "rooms" | "users") => {
    setSearchType(type);
    setSearchQuery("");
    setRoomResults([]);
    setUserResults([]);
  };

  useEffect(() => {
    if (searchType) {
      fetchSearchResults();
    } else {
      setRoomResults([]);
      setUserResults([]);
    }
  }, [debouncedSearchQuery, searchType, fetchSearchResults]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const renderRoomSearchResult = (result: RoomWithMembershipCount) => (
    <li
      key={result.id}
      className="flex items-center justify-between pb-[1em] rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/30">
          <span className="text-lg font-semibold text-indigo-400">
            {result.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-black dark:text-white">
              {result.name}
            </span>
            {result.is_private && (
              <LockIcon className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {result.memberCount} {result.memberCount === 1 ? "member" : "members"}
          </div>
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2">
        {result.isMember ? (
          <>
            {/* Settings button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/rooms/${result.id}/settings`)}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Leave button (only if member) */}
            <Button
              size="icon"
              variant="ghost"
              onClick={async () => {
                if (!user) {
                  toast.error("Please log in to leave a room");
                  return;
                }
                if (!result.id || !UUID_REGEX.test(result.id)) {
                  toast.error("Invalid room ID");
                  return;
                }
                try {
                  const { error: membersError } = await supabase
                    .from("room_members")
                    .delete()
                    .eq("room_id", result.id)
                    .eq("user_id", user.id);

                  const { error: participantsError } = await supabase
                    .from("room_participants")
                    .delete()
                    .eq("room_id", result.id)
                    .eq("user_id", user.id);

                  if (membersError || participantsError) {
                    throw new Error(
                      membersError?.message ||
                      participantsError?.message ||
                      "Failed to leave room"
                    );
                  }

                  toast.success("Successfully left the room");

                  setRoomResults((prev) =>
                    prev.map((room) =>
                      room.id === result.id
                        ? { ...room, isMember: false, participationStatus: null }
                        : room
                    )
                  );

                  if (selectedRoom?.id === result.id) {
                    setSelectedRoom(null);
                    router.push("/");
                  }
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to leave room"
                  );
                }
              }}
              className="bg-red-500 hover:bg-red-600 rounded-md text-white"
              title="Leave Room"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : result.participationStatus === "pending" ? (
          <span className="text-sm text-yellow-500 dark:text-yellow-400">
            Pending
          </span>
        ) : (
          <Button
            size="sm"
            onClick={() => handleJoinRoom(result.id)}
            disabled={!user}
            className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            Join
          </Button>
        )}
      </div>
    </li>
  );


  return (
    <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Search className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={0}
        className="
          w-[400px]
          p-4
          bg-popover
          text-popover-foreground
          backdrop-blur-lg
          border
          border-border
          shadow-xl
          rounded-xl
        "
      >
        <div className="p-1">
          <div className="flex justify-between items-center mb-[0.5em]">
            <h3 className="font-bold text-[1.5em]">Search</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchPopoverOpen(false);
                router.push("/profile");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          <Input
            type="text"
            placeholder={searchType === "users" ? "Search users..." : "Search rooms..."}
            value={searchQuery}
            onChange={handleSearchInputChange}
            className="
              mb-1 bg-muted/50 border-border text-foreground 
              placeholder-muted-foreground rounded-lg 
              focus:ring-2 focus:ring-indigo-500 
              focus:border-indigo-500 transition-all
            "
          />

          {/* Toggle buttons */}
          <div className="w-[100%] flex gap-1 mb-[1.2em]">
            <Button
              variant={searchType === "rooms" ? "default" : "outline"}
              onClick={() => handleSearchByType("rooms")}
              className={`${
                searchType === "rooms"
                  ? "bg-violet-900 text-white hover:bg-violet-800"
                  : "bg-transparent border border-border hover:bg-accent text-black dark:text-white"
              } rounded-lg transition-colors w-full`}
            >
              Rooms
            </Button>
            <Button
              variant={searchType === "users" ? "default" : "outline"}
              onClick={() => handleSearchByType("users")}
              className={`${
                searchType === "users"
                  ? "bg-violet-900 text-white hover:bg-violet-800"
                  : "bg-transparent border border-border hover:bg-accent text-black dark:text-white"
              } rounded-lg transition-colors w-full`}
            >
              Users
            </Button>
          </div>

          {/* Results */}
          {searchType === "users" && userResults.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">
                User Profiles
              </h4>
              <ul className="space-y-3 overflow-y-auto max-h-[440px] scrollbar-none lg:scrollbar-custom">
                {userResults.map((result) => (
                  <li
                    key={result.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {result.avatar_url ? (
                          <AvatarImage
                            src={result.avatar_url}
                            alt={result.username || "Avatar"}
                            className="rounded-full"
                          />
                        ) : (
                          <AvatarFallback className="bg-indigo-500 text-white rounded-full">
                            {result.username?.charAt(0).toUpperCase() ||
                              result.display_name?.charAt(0).toUpperCase() ||
                              "?"}
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
                ))}
              </ul>
            </div>
          )}

          {/* Rooms results */}
          {searchType === "rooms" && (
            <div className="mt-4">
              <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">Rooms</h4>
              <ul className="space-y-[.1em] overflow-y-auto max-h-[440px] py-[.2em] rounded-lg scrollbar-none lg:scrollbar-custom">
                {isLoading ? (
                  Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted animate-pulse"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-accent"></div>
                          <div>
                            <div className="h-4 w-32 bg-accent rounded mb-2"></div>
                            <div className="h-3 w-24 bg-accent rounded"></div>
                          </div>
                        </div>
                        <div className="h-8 w-16 bg-accent rounded"></div>
                      </li>
                    ))
                ) : roomResults.length > 0 ? (
                  roomResults.map((result) => renderRoomSearchResult(result))
                ) : (
                  <li className="text-[1em] text-muted-foreground p-2">No rooms found</li>
                )}
              </ul>
            </div>
          )}

          {/* Empty & Loading states */}
          {((searchType === "users" && userResults.length === 0) ||
            (searchType === "rooms" && roomResults.length === 0)) &&
            searchQuery.length > 0 && (
              <p className="text-[1em] text-muted-foreground mt-3">
                No {searchType} found.
              </p>
            )}

          {searchQuery.length === 0 && searchType && (
            <p
              className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${
                isFaded ? "opacity-0" : "opacity-100"
              }`}
            >
              Showing all {searchType}...
            </p>
          )}

          {isLoading && (
            <p
              className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${
                isFaded ? "opacity-0" : "opacity-100"
              }`}
            >
              Loading...
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
