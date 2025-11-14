// components/SearchComponent.tsx
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
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";

import {
  useAvailableRooms,
  useRoomActions,
  useRoomPresence,
  fetchAllUsers,
  type Room,
} from "@/lib/store/RoomContext";

import {
  Users as UsersIcon,
  Lock as LockIcon,
  Settings,
  LogOut,
  User as UserIcon,
  Search as SearchIcon,
} from "lucide-react";

/**
 * Enhanced SearchComponent (realtime + polished UI)
 *
 * - Realtime data comes from your RoomContext (availableRooms + roomPresence)
 * - Client-side search with highlighting and debounced input
 * - Clean responsive cards, skeletons, presence badges, accessible buttons
 *
 * Drop-in replacement for your existing SearchComponent file.
 */

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function highlightMatch(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="bg-yellow-200 dark:bg-yellow-600/30 px-[2px] rounded-sm">{match}</span>
      {after}
    </>
  );
}

const SkeletonCard = ({ keyIdx = 0 }: { keyIdx?: number }) => (
  <div key={keyIdx} className="p-4 border rounded-lg bg-card animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="h-12 w-12 rounded-lg bg-accent" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/5 bg-accent rounded" />
        <div className="h-3 w-1/3 bg-accent rounded" />
      </div>
    </div>
    <div className="h-8 w-full bg-accent rounded" />
  </div>
);

const SearchComponent = memo(function SearchComponent({
  user,
}: {
  user: SupabaseUser | undefined;
}) {
  const router = useRouter();

  // local UI state
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [debouncedQuery] = useDebounce(query, 300);

  // store (realtime)
  const availableRooms = useAvailableRooms();
  const presence = useRoomPresence(); // Record<roomId, { onlineUsers, userIds }>
  const { joinRoom, leaveRoom } = useRoomActions();

  // derived filtered lists (instant, from realtime store)
  const filteredRooms = useMemo(() => {
    if (!debouncedQuery.trim()) return availableRooms;
    const q = debouncedQuery.toLowerCase();
    return availableRooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [availableRooms, debouncedQuery]);

  // users search (server) — only when users tab active
  const fetchUsers = useCallback(
    async (q: string) => {
      setLoadingUsers(true);
      try {
        const all = await fetchAllUsers();
        if (!q.trim()) {
          setUserResults(all);
          return;
        }
        const low = q.toLowerCase();
        setUserResults(
          all.filter(
            (u) =>
              u.username?.toLowerCase().includes(low) ||
              u.display_name?.toLowerCase().includes(low)
          )
        );
      } catch (err) {
        console.error("fetchUsers", err);
        toast.error("Failed to fetch users");
      } finally {
        setLoadingUsers(false);
      }
    },
    []
  );

  useEffect(() => {
    if (tab === "users") fetchUsers(debouncedQuery);
    else setUserResults([]);
  }, [tab, debouncedQuery, fetchUsers]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      if (!UUID_REGEX.test(roomId)) {
        toast.error("Invalid room id");
        return;
      }
      if (!user?.id) {
        toast.error("Login required");
        return;
      }
      try {
        await joinRoom(roomId);
      } catch (err: any) {
        console.error("join error", err);
        toast.error(err?.message ?? "Failed to join room");
      }
    },
    [joinRoom, user?.id]
  );

  const handleLeave = useCallback(
    async (roomId: string) => {
      try {
        await leaveRoom(roomId);
      } catch (err: any) {
        console.error("leave error", err);
        toast.error(err?.message ?? "Failed to leave room");
      }
    },
    [leaveRoom]
  );

  // keyboard: Enter focuses first result
  useEffect(() => {
    // no-op for now; keep placeholder for future keyboard UX
  }, []);

  // small presentational renderers
  const RoomCard = useCallback(
    ({ room }: { room: Room }) => {
      const pres = presence?.[room.id];
      const online = pres?.onlineUsers ?? 0;
      const members = room.memberCount ?? 0;
      const q = debouncedQuery;

      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          key={room.id}
          className="p-4 border rounded-xl bg-card hover:shadow-md transition"
        >
          <div className="flex items-start gap-4">
            <div
              aria-hidden
              className="h-12 w-12 flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-400/6 text-indigo-500 text-lg font-bold"
            >
              {room.name?.charAt(0).toUpperCase() || "#"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/rooms/${room.id}`)}
                  className="text-foreground font-semibold text-sm truncate hover:underline text-left"
                  aria-label={`Open room ${room.name}`}
                >
                  #{highlightMatch(room.name, q) as React.ReactNode}
                </button>

                {room.is_private && (
                  <LockIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <UsersIcon className="h-3 w-3" />
                  <span className="font-medium text-foreground">{members}</span>
                  <span className="opacity-70">members</span>
                </span>

                {online > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="font-medium text-foreground">{online}</span>
                    <span className="opacity-70">online</span>
                  </span>
                )}

                {room.participationStatus === "pending" && (
                  <span className="text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded-md">
                    Pending
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {room.isMember ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/rooms/${room.id}/settings`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLeave(room.id)}
                    className="text-red-500"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="bg-indigo-600 text-white"
                  onClick={() => handleJoin(room.id)}
                >
                  Join
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      );
    },
    [presence, debouncedQuery, router, handleJoin, handleLeave]
  );

  const UserRow = useCallback(
    ({ u }: { u: PartialProfile }) => (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        key={u.id}
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition"
      >
        <Avatar className="h-10 w-10">
          {u.avatar_url ? (
            <AvatarImage src={u.avatar_url} alt={u.display_name ?? u.username ?? "User"} />
          ) : (
            <AvatarFallback>{(u.display_name ?? u.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {highlightMatch(u.display_name ?? u.username ?? "Unknown", debouncedQuery)}
          </div>
          <div className="text-xs text-muted-foreground">@{u.username}</div>
        </div>

        <div className="ml-auto">
          <Button size="sm" variant="ghost" onClick={() => router.push(`/profile/${u.id}`)}>
            <UserIcon className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    ),
    [debouncedQuery, router]
  );

  // final render
  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <label htmlFor="global-search" className="sr-only">
            Search rooms or users
          </label>
          <div className="relative">
            <Input
              id="global-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rooms or people — try ‘design’, ‘general’..."
              className="pl-10"
              aria-label="Search rooms or users"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <SearchIcon className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant={tab === "rooms" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("rooms")}
          >
            Rooms
          </Button>
          <Button
            variant={tab === "users" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("users")}
          >
            Users
          </Button>
        </div>
      </div>

      {/* mobile tabs (compact) */}
      <div className="sm:hidden mb-3 flex gap-2">
        <button
          className={`flex-1 py-2 rounded-lg ${tab === "rooms" ? "bg-[color:var(--action-active)]/20 text-[color:var(--action-active)]" : "bg-muted/10"}`}
          onClick={() => setTab("rooms")}
        >
          Rooms
        </button>
        <button
          className={`flex-1 py-2 rounded-lg ${tab === "users" ? "bg-[color:var(--action-active)]/20 text-[color:var(--action-active)]" : "bg-muted/10"}`}
          onClick={() => setTab("users")}
        >
          Users
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {tab === "rooms" ? (
            <motion.div key="rooms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {availableRooms.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground border rounded-lg bg-card">
                  No rooms available yet — try creating one or refresh.
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground border rounded-lg bg-card">
                  No rooms match your search.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredRooms.map((r) => (
                    <Fragment key={r.id}>
                      <RoomCard room={r} />
                    </Fragment>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loadingUsers ? (
                <div className="grid gap-3">
                  <SkeletonCard keyIdx={1} />
                  <SkeletonCard keyIdx={2} />
                  <SkeletonCard keyIdx={3} />
                </div>
              ) : userResults.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground border rounded-lg bg-card">
                  No users found.
                </div>
              ) : (
                <div className="grid gap-2">
                  {userResults.map((u) => (
                    <UserRow key={u.id} u={u} />
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