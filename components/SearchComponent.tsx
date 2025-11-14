"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  Fragment,
} from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
  Users as UsersIcon,
  Lock as LockIcon,
  Search as SearchIcon,
  LogOut,
  Settings,
} from "lucide-react";

import {
  useAvailableRooms,
  useRoomActions,
  useRoomPresence,
  fetchAllUsers,
  type Room,
} from "@/lib/store/RoomContext";

import { useDebounce } from "use-debounce";
import { toast } from "sonner";

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-yellow-300/40 dark:bg-yellow-600/40 px-0.5 rounded">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

const SearchComponent = memo(function SearchComponentUltra({
  user,
}: {
  user: any;
}) {
  const router = useRouter();

  // local state
  const [query, setQuery] = useState("");
  const [debounced] = useDebounce(query, 300);
  const [tab, setTab] = useState<"rooms" | "users">("rooms");

  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // store
  const rooms = useAvailableRooms();
  const presence = useRoomPresence();
  const { joinRoom, leaveRoom } = useRoomActions();

  // filtering
  const filteredRooms = useMemo(() => {
    if (!debounced) return rooms;
    return rooms.filter((r) =>
      r.name.toLowerCase().includes(debounced.toLowerCase())
    );
  }, [rooms, debounced]);

  // fetch users on user tab
  useEffect(() => {
    if (tab !== "users") return;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetchAllUsers();
        const q = debounced.toLowerCase();
        setUserResults(
          res.filter(
            (u) =>
              u.username?.toLowerCase().includes(q) ||
              u.display_name?.toLowerCase().includes(q)
          )
        );
      } catch {
        toast.error("Failed loading users");
      }
      setLoadingUsers(false);
    })();
  }, [tab, debounced]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      if (!UUID_REGEX.test(roomId)) return;
      try {
        await joinRoom(roomId);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to join");
      }
    },
    [joinRoom]
  );

  const handleLeave = useCallback(
    async (roomId: string) => {
      try {
        await leaveRoom(roomId);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to leave");
      }
    },
    [leaveRoom]
  );

  // -------------------------
  // CARD COMPONENT
  // -------------------------
  const RoomCard = ({ room }: { room: Room }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;
    const members = room.memberCount ?? 0;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        key={room.id}
        className="
          rounded-2xl shadow-sm border bg-card relative overflow-hidden
          flex flex-col min-w-[260px] md:min-w-0
          aspect-[3/4]
        "
      >
        {/* TOP HEADER */}
        <div className="h-20 bg-gradient-to-br from-indigo-500/30 to-indigo-600/20 p-4 flex items-center justify-between">
          <div className="text-lg font-semibold truncate text-foreground flex items-center gap-2">
            #{highlight(room.name, debounced) as any}
            {room.is_private && <LockIcon className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-col flex-1 p-4 justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {members} members
              </span>

              {online > 0 && (
                <div className="flex items-center gap-1 ml-2 text-xs">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {online} online
                  </span>
                </div>
              )}
            </div>

            {room.participationStatus === "pending" && (
              <span className="text-yellow-700 bg-yellow-300/30 rounded-md px-2 py-1 text-xs font-medium">
                Pending approval
              </span>
            )}
          </div>

          {/* ACTIONS */}
          <div className="mt-4 flex flex-col gap-2">
            {room.isMember ? (
              <>
                <Button
                  size="sm"
                  onClick={() => router.push(`/rooms/${room.id}`)}
                  className="bg-indigo-600 text-white"
                >
                  Open Room
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLeave(room.id)}
                  className="text-red-500"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Room
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => handleJoin(room.id)}
                className="bg-indigo-600 text-white"
              >
                Join Room
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // -------------------------
  // PAGE LAYOUT
  // -------------------------
  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6">
      {/* Header Search Bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Input
            placeholder="Search rooms or users…"
            className="pl-10 h-11 rounded-xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button
            variant={tab === "rooms" ? "default" : "ghost"}
            onClick={() => setTab("rooms")}
            className="rounded-xl"
          >
            Rooms
          </Button>
          <Button
            variant={tab === "users" ? "default" : "ghost"}
            onClick={() => setTab("users")}
            className="rounded-xl"
          >
            Users
          </Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex mb-4 gap-2">
        <button
          onClick={() => setTab("rooms")}
          className={`flex-1 py-2 rounded-xl ${
            tab === "rooms" ? "bg-indigo-500/20 text-indigo-500" : "bg-muted/20"
          }`}
        >
          Rooms
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex-1 py-2 rounded-xl ${
            tab === "users" ? "bg-indigo-500/20 text-indigo-500" : "bg-muted/20"
          }`}
        >
          Users
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "rooms" && (
          <motion.div
            key="rooms"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 🔥 Desktop = columns | Mobile = horizontal scroll */}
            <div
              className="
                grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 
                gap-6 
                md:overflow-visible
                max-md:flex max-md:overflow-x-auto max-md:gap-4 max-md:pb-3 
                snap-x snap-mandatory
              "
            >
              {filteredRooms.map((room) => (
                <div key={room.id} className="snap-center max-md:min-w-[80%]">
                  <RoomCard room={room} />
                </div>
              ))}
            </div>

            {filteredRooms.length === 0 && (
              <p className="text-center text-muted-foreground py-10">
                No rooms found.
              </p>
            )}
          </motion.div>
        )}

        {tab === "users" && (
          <motion.div
            key="users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {loadingUsers && (
              <p className="text-center py-8 text-muted-foreground">Loading…</p>
            )}

            {!loadingUsers &&
              userResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-3 bg-card border rounded-xl mb-2"
                >
                  <Avatar>
                    <AvatarFallback>
                      {(u.display_name ?? u.username ?? "?")[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <p className="font-medium">
                      {highlight(
                        u.display_name ?? u.username ?? "Unknown",
                        debounced
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{u.username}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => router.push(`/profile/${u.id}`)}
                  >
                    View
                  </Button>
                </div>
              ))}

            {!loadingUsers && userResults.length === 0 && (
              <p className="text-center py-10 text-muted-foreground">
                No users found.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SearchComponent.displayName = "SearchComponentUltra";
export default SearchComponent;



// "use client";
// import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
// import { Button } from "./ui/button";
// import { User as SupabaseUser } from "@supabase/supabase-js";
// import { useRouter } from "next/navigation";
// import { Settings, UserIcon, LockIcon, LogOut, Users } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import { toast } from "sonner";
// import { useAvailableRooms, useRoomActions, useRoomPresence, fetchAllUsers, type Room } from "@/lib/store/RoomContext";
// import { useDebounce } from "use-debounce";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// type RoomWithMembershipCount = Room;

// type PartialProfile = {
//   id: string;
//   username: string | null;
//   display_name: string | null;
//   avatar_url: string | null;
//   created_at: string | null;
// };

// // 🚀 Just use Room — no extended type required


// const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// const SearchComponent = memo(function SearchComponent({
//   user,
// }: {
//   user: SupabaseUser | undefined;
// }) {
//   const router = useRouter();
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchType, setSearchType] = useState<"rooms" | "users">("rooms");
//   const [userResults, setUserResults] = useState<PartialProfile[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isFaded, setIsFaded] = useState(false);
  
//   const isMounted = useRef(true);
//   const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
  
//   // ✅ FIXED: Use Zustand selectors
//   const availableRooms = useAvailableRooms();
//   const { joinRoom, leaveRoom } = useRoomActions();
//   const roomPresence = useRoomPresence(); // ✅ FIXED: This is an object, not a function

//   // ✅ FIXED: Stable mount state management
//   useEffect(() => {
//     const timer = setTimeout(() => setIsFaded(true), 2);
//     return () => {
//       clearTimeout(timer);
//       isMounted.current = false;
//     };
//   }, []);

//   // ✅ FIXED: Stable search handler with proper typing
//   const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
//     setSearchQuery(e.target.value);
//   }, []);

//   // ✅ FIXED: Optimized user search with proper error handling
//   const fetchUserResults = useCallback(async () => {
//     if (searchType !== "users" || !user?.id) {
//       setIsLoading(false);
//       setUserResults([]);
//       return;
//     }
    
//     if (!isMounted.current) return;
    
//     setIsLoading(true);
//     try {
//       const users = await fetchAllUsers(); // ✅ FIXED: Now imported directly
//       if (!isMounted.current) return;

//       if (debouncedSearchQuery.trim()) {
//         const q = debouncedSearchQuery.toLowerCase();
//         const filteredUsers = users.filter(
//           (u: PartialProfile) =>
//             u.username?.toLowerCase().includes(q) ||
//             u.display_name?.toLowerCase().includes(q)
//         );
//         setUserResults(filteredUsers);
//       } else {
//         setUserResults(users);
//       }
//     } catch (error) {
//       if (!isMounted.current) return;
//       console.error("User search error:", error);
//       toast.error(
//         error instanceof Error ? error.message : "An error occurred while searching users"
//       );
//       setUserResults([]);
//     } finally {
//       if (isMounted.current) setIsLoading(false);
//     }
//   }, [searchType, user?.id, debouncedSearchQuery]); // ✅ FIXED: Removed fetchAllUsers from deps

//   // ✅ FIXED: Optimized effect for user search
//   useEffect(() => {
//     if (searchType === "users") {
//       fetchUserResults();
//     } else {
//       setUserResults([]);
//     }
//   }, [searchType, debouncedSearchQuery, fetchUserResults]);

//   // ✅ FIXED: Stable room results with proper filtering
//   const roomResults = useMemo(() => {
//     if (availableRooms.length === 0) {
//       return [];
//     }
    
//     if (!debouncedSearchQuery.trim()) {
//       return availableRooms.filter(room => room.id);
//     }
    
//     const q = debouncedSearchQuery.toLowerCase();
//     return availableRooms.filter((room) => 
//       room.id && room.name.toLowerCase().includes(q)
//     );
//   }, [availableRooms, debouncedSearchQuery]);

//   // ✅ FIXED: Stable join room handler with proper validation
//   const handleJoinRoom = useCallback(
//     async (roomId: string) => {
//       if (!roomId || roomId === 'undefined' || !UUID_REGEX.test(roomId)) {
//         console.error("❌ Invalid room ID:", roomId);
//         toast.error("Invalid room ID. Try refreshing the list.");
//         return;
//       }

//       if (!user?.id) {
//         toast.error("You must be logged in to join a room");
//         return;
//       }

//       try {
//         await joinRoom(roomId);
//       } catch (error) {
//         console.error("Join room error:", error);
//         const errorMsg = (error as Error).message || "Failed to join room";
//         toast.error(errorMsg);
//       }
//     },
//     [user?.id, joinRoom]
//   );

//   // ✅ FIXED: Stable room render with optimized presence data
//   const renderRoomSearchResult = useCallback((result: RoomWithMembershipCount) => {
//     if (!result.id) return null;

//     // ✅ FIXED: Access presence directly from the object
//     const presence = roomPresence[result.id];
//     const onlineCount = presence?.onlineUsers ?? 0;
//     const memberCount = result.memberCount ?? 0;
    
//     return (
//       <div
//         key={result.id}
//         className="flex flex-col p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all hover:shadow-md"
//       >
//         <div className="flex items-start justify-between mb-3">
//           <div className="flex items-center gap-3 flex-1">
//             <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/30 flex-shrink-0">
//               <span className="text-xl font-semibold text-indigo-400">
//                 {result.name.charAt(0).toUpperCase()}
//               </span>
//             </div>
//             <div className="flex-1 min-w-0">
//               <div className="flex items-center gap-2 mb-2">
//                 <span className="font-semibold text-lg text-foreground truncate">
//                   #{result.name}
//                 </span>
//                 {result.is_private && (
//                   <LockIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
//                 )}
//               </div>
              
//               {/* ✅ FIXED: Stable member count display */}
//               <div className="flex items-center gap-2 flex-wrap">
//                 {/* Total Members Badge */}
//                 <div className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
//                   <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
//                   <span className="font-semibold text-blue-600 dark:text-blue-400">
//                     {memberCount}
//                   </span>
//                   <span className="text-blue-600/70 dark:text-blue-400/70">
//                     {memberCount === 1 ? "member" : "members"}
//                   </span>
//                 </div>
                
//                 {/* Online Users Badge */}
//                 {onlineCount > 0 && (
//                   <div className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
//                     <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
//                     <span className="font-semibold text-green-600 dark:text-green-400">
//                       {onlineCount}
//                     </span>
//                     <span className="text-green-600/70 dark:text-green-400/70">
//                       online
//                     </span>
//                   </div>
//                 )}
                
//                 {/* Membership Status Badge */}
//                 {result.isMember && (
//                   <div className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
//                     <span className="text-green-600 dark:text-green-400">
//                       ✓ Joined
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
        
//         <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
//           {result.isMember ? (
//             <>
//               <Button
//                 size="sm"
//                 variant="ghost"
//                 onClick={() => router.push(`/rooms/${result.id}/settings`)}
//                 className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
//               >
//                 <Settings className="h-4 w-4 mr-2" />
//                 Settings
//               </Button>
//               <Button
//                 size="sm"
//                 variant="ghost"
//                 onClick={() => leaveRoom(result.id)}
//                 className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
//                 title="Leave Room"
//               >
//                 <LogOut className="h-4 w-4 mr-2" />
//                 Leave
//               </Button>
//             </>
//           ) : result.participationStatus === "pending" ? (
//             <span className="text-sm text-yellow-500 dark:text-yellow-400 font-medium px-3 py-1 bg-yellow-500/10 rounded-md">
//               Pending Request
//             </span>
//           ) : (
//             <Button
//               size="sm"
//               onClick={() => handleJoinRoom(result.id)}
//               disabled={!user}
//               className="bg-indigo-500 text-white hover:bg-indigo-600 transition-colors w-full"
//             >
//               Join Room
//             </Button>
//           )}
//         </div>
//       </div>
//     );
//   }, [router, user, handleJoinRoom, leaveRoom, roomPresence]); // ✅ FIXED: Changed getRoomPresence to roomPresence

//   // ✅ FIXED: Optimized loading state calculation
//   const showLoading = useMemo(() => 
//     isLoading,
//     [isLoading]
//   );

//   // ✅ FIXED: Memoized tab change handler
//   const handleTabChange = useCallback((value: string) => {
//     setSearchType(value as "rooms" | "users");
//   }, []);

//   // ✅ FIXED: Memoized profile navigation
//   const handleProfileNavigation = useCallback(() => {
//     router.push("/profile");
//   }, [router]);

//   // ✅ FIXED: Memoized user list items
//   const userListItems = useMemo(() => 
//     userResults.map((result) => (
//       <li key={result.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
//         <div className="flex items-center gap-3">
//           <Avatar className="h-10 w-10">
//             {result.avatar_url ? (
//               <AvatarImage src={result.avatar_url} alt={result.username || "Avatar"} />
//             ) : (
//               <AvatarFallback className="bg-indigo-500 text-white">
//                 {result.username?.charAt(0).toUpperCase() || result.display_name?.charAt(0).toUpperCase() || "?"}
//               </AvatarFallback>
//             )}
//           </Avatar>
//           <div>
//             <div className="text-xs text-muted-foreground">{result.username}</div>
//             <div className="text-[1em] font-medium text-black dark:text-white">
//               {result.display_name}
//             </div>
//           </div>
//         </div>
//         <UserIcon className="h-4 w-4 text-muted-foreground" />
//       </li>
//     )),
//     [userResults]
//   );

//   // ✅ FIXED: Memoized loading skeletons
//   const loadingSkeletons = useMemo(() => 
//     Array.from({ length: 3 }).map((_, i) => (
//       searchType === "rooms" ? (
//         <div key={i} className="flex flex-col p-4 rounded-lg border border-border bg-card animate-pulse">
//           <div className="flex items-center gap-3 mb-3">
//             <div className="h-12 w-12 rounded-lg bg-accent" />
//             <div className="flex-1">
//               <div className="h-5 w-32 bg-accent rounded mb-2" />
//               <div className="h-4 w-24 bg-accent rounded" />
//             </div>
//           </div>
//           <div className="h-8 w-full bg-accent rounded" />
//         </div>
//       ) : (
//         <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted animate-pulse">
//           <div className="flex items-center gap-3">
//             <div className="h-10 w-10 rounded-full bg-accent" />
//             <div>
//               <div className="h-4 w-24 bg-accent rounded mb-2" />
//               <div className="h-3 w-16 bg-accent rounded" />
//             </div>
//           </div>
//           <div className="h-6 w-6 bg-accent rounded" />
//         </li>
//       )
//     )),
//     [searchType]
//   );

//   // ✅ FIXED: Memoized empty state messages
//   const emptyStateMessage = useMemo(() => {
//     if (searchType === "rooms") {
//       return debouncedSearchQuery ? "No rooms found" : "No rooms available";
//     } else {
//       return debouncedSearchQuery ? "No users found" : "Search for users to see results";
//     }
//   }, [searchType, debouncedSearchQuery]);

//   return (
//     <div className="w-full max-w-[400px] mx-auto p-4">
//       <div className="flex justify-between items-center mb-4">
//         <h3 className="font-bold text-[1.5em]">Search</h3>
//         <Button
//           variant="ghost"
//           size="icon"
//           onClick={handleProfileNavigation}
//           className="text-muted-foreground hover:text-foreground transition-colors"
//         >
//           <Settings className="h-4 w-4" />
//         </Button>
//       </div>
      
//       <Input
//         type="text"
//         placeholder={
//           searchType === "users"
//             ? "Search users..."
//             : "Search rooms..."
//         }
//         value={searchQuery}
//         onChange={handleSearchInputChange}
//         className="mb-4 bg-muted/50 border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
//       />
      
//       <Tabs
//         defaultValue={searchType}
//         onValueChange={handleTabChange}
//         className="w-full"
//       >
//         <TabsList className="grid w-full grid-cols-2 mb-4">
//           <TabsTrigger value="rooms">Rooms</TabsTrigger>
//           <TabsTrigger value="users">Users</TabsTrigger>
//         </TabsList>
        
//         <TabsContent value="rooms">
//           <div className="mt-4">
//             <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">Rooms</h4>
//             <div className="grid gap-3 overflow-y-auto max-h-[440px] py-[0.2em] rounded-lg scrollbar-none lg:scrollbar-custom">
//               {showLoading ? (
//                 loadingSkeletons
//               ) : roomResults.length > 0 ? (
//                 roomResults.map((result) => renderRoomSearchResult(result))
//               ) : (
//                 <div className="text-[1em] text-muted-foreground p-4 text-center border border-border rounded-lg bg-card">
//                   {emptyStateMessage}
//                 </div>
//               )}
//             </div>
//           </div>
//         </TabsContent>
        
//         <TabsContent value="users">
//           <div className="mt-4">
//             <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">User Profiles</h4>
//             <ul className="space-y-3 overflow-y-auto max-h-[440px] scrollbar-none lg:scrollbar-custom">
//               {showLoading ? (
//                 loadingSkeletons
//               ) : userResults.length > 0 ? (
//                 userListItems
//               ) : (
//                 <li className="text-[1em] text-muted-foreground p-2 text-center">
//                   {emptyStateMessage}
//                 </li>
//               )}
//             </ul>
//           </div>
//         </TabsContent>
//       </Tabs>
      
//       {searchQuery.length === 0 && searchType && (
//         <p className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${isFaded ? "opacity-0" : "opacity-100"}`}>
//           Showing all {searchType}...
//         </p>
//       )}
      
//       {showLoading && (
//         <p className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${isFaded ? "opacity-0" : "opacity-100"}`}>
//           Loading...
//         </p>
//       )}
//     </div>
//   );
// });

// export default SearchComponent;