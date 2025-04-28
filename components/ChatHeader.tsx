// "use client";

// import { useState, useEffect, useRef, useCallback } from "react";
// import { Button } from "./ui/button";
// import { supabaseBrowser } from "@/lib/supabase/browser";
// import { User as SupabaseUser } from "@supabase/supabase-js";
// import { useRouter } from "next/navigation";
// import ChatPresence from "./ChatPresence";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Search, User as UserIcon, Settings, PlusCircle } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import { Database } from "@/lib/types/supabase";
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// import { toast } from "sonner";
// import { Switch } from "@/components/ui/switch";
// import { Label } from "@/components/ui/label";
// import { useRoomStore } from "@/lib/store/roomstore";
// import { useDebounce } from "use-debounce";

// type UserProfile = Database["public"]["Tables"]["users"]["Row"];
// type Room = Database["public"]["Tables"]["rooms"]["Row"];
// type SearchResult = UserProfile | Room;

// export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
//   const router = useRouter();
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
//   const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
//   const supabase = supabaseBrowser();
//   const [isPopoverOpen, setIsPopoverOpen] = useState(false);
//   const [isDialogOpen, setIsDialogOpen] = useState(false);
//   const [newRoomName, setNewRoomName] = useState("");
//   const [isPrivate, setIsPrivate] = useState(false);
//   const [isCreating, setIsCreating] = useState(false);
//   const selectedRoom = useRoomStore((state) => state.selectedRoom);
//   const isMounted = useRef(true);
//   const [isLoading, setIsLoading] = useState(false);

//   const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
//   const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

//   const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     debouncedCallback(e.target.value);
//     setSearchQuery(e.target.value);
//   };

//   const fetchSearchResults = useCallback(async () => {
//        if (!debouncedSearchQuery.trim() || !searchType) {
//         setSearchResults([]);
//         setIsLoading(false);
        
//         try {
//           const response = await fetch('/api/rooms/all');
//           const data = await response.json();
//           if (response.ok) {
//             setSearchResults(data.rooms || []);
//           } else {
//             console.error(data.error || "Failed to fetch all rooms");
//           }
//         } catch (error) {
//           console.error("Error fetching all rooms:", error);
//         }
        
//         return; // Ensure return happens after the fetch logic
//       }
    

//     setIsLoading(true);
//     try {

//       const response = await fetch(`/api/${searchType}/search?query=${encodeURIComponent(debouncedSearchQuery)}`);
//       const data = await response.json();

//       if (isMounted.current) {
//         if (response.ok) {
//           let results: SearchResult[] = [];
//           if (searchType === "users") {
//             results = Array.isArray(data) ? (data as UserProfile[]) : [];
//           } else if (searchType === "rooms") {
//             results = data.rooms && Array.isArray(data.rooms) ? (data.rooms as Room[]) : [];
//           }
//           setSearchResults(results);
//         } else {
//           toast.error(data.error || `Failed to search ${searchType}`);
//           setSearchResults([]);
//         }
//       }
//     } catch (error) {
//       console.error("Search error:", error);
//       if (isMounted.current) {
//         toast.error("An error occurred while searching");
//         setSearchResults([]);
//       }
//     } finally {
//       if (isMounted.current) {
//         setIsLoading(false);
//       }
//     }
//   }, [debouncedSearchQuery, searchType]);

//   useEffect(() => {
//     fetchSearchResults();
//   }, [debouncedSearchQuery, searchType, fetchSearchResults]);

//   useEffect(() => {
//     return () => {
//       isMounted.current = false;
//     };
//   }, []);

//   useEffect(() => {
//     const channel = supabase
//       .channel("rooms")
//       .on(
//         "postgres_changes",
//         { event: "*", schema: "public", table: "rooms" },
//         (payload) => {
//           if (isMounted.current && payload.new) useRoomStore.getState().setRooms(Array.isArray(payload.new) ? payload.new : [payload.new]);
//         }
//       )
//       .subscribe((status) => {
//         console.log("Subscription status:", status);
//         if (status === "CLOSED") toast.error("Room subscription closed");
//       });

//     return () => {
//       isMounted.current = false;
//       supabase.removeChannel(channel);
//     };
//   }, [supabase]);

//   const handleCreateRoom = async () => {
//     if (!user) {
//       toast.error("You must be logged in to create a room");
//       return;
//     }

//     if (!newRoomName.trim()) {
//       toast.error("Room name cannot be empty");
//       return;
//     }

//     setIsCreating(true);

//     try {
//       const response = await fetch("/api/rooms", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           name: newRoomName.trim(),
//           is_private: isPrivate,
//         }),
//       });

//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.error || "Failed to create room");
//       }

//       if (isMounted.current) {
//         const { data: newRooms } = await supabase.from("rooms").select("*");
//         useRoomStore.getState().setRooms(newRooms || []);
//         const newRoom = newRooms?.find((room) => room.name === newRoomName.trim());
//         if (newRoom) {
//           // Automatically join the creator to the new room
//           await handleJoinRoom(newRoom.id);
//         }
//         toast.success("Room created successfully!");
//         setNewRoomName("");
//         setIsPrivate(false);
//         setIsDialogOpen(false);
//       }
//     } catch (error) {
//       if (isMounted.current) {
//         toast.error(error instanceof Error ? error.message : "Failed to create room");
//       }
//     } finally {
//       if (isMounted.current) {
//         setIsCreating(false);
//       }
//     }
//   };

//   const handleLoginWithGithub = () => {
//     supabase.auth.signInWithOAuth({
//       provider: "github",
//       options: {
//         redirectTo: location.origin + "/auth/callback",
//       },
//     });
//   };

//   const handleLogout = async () => {
//     await supabase.auth.signOut();
//     router.refresh();
//   };

//   const handleSearchByType = (type: "rooms" | "users") => {
//     setSearchType(type);
//     setSearchQuery("");
//   };

//   const handleJoinRoom = async (roomId?: string) => {
//     if (!user) {
//       toast.error("You must be logged in to join a room");
//       return;
//     }

//     const currentRoomId = roomId || selectedRoom?.id;
//     if (!currentRoomId) {
//       toast.error("No current room selected or invalid room ID");
//       console.error("No valid roomId available:", { roomId, selectedRoom });
//       return;
//     }

//     // Check if already joined
//     const { data: existingParticipation } = await supabase
//       .from("room_participants")
//       .select("status")
//       .eq("room_id", currentRoomId)
//       .eq("user_id", user.id)
//       .single();

//     if (existingParticipation && existingParticipation.status === "accepted") {
//       toast.info("You are already a member of this room");
//       return;
//     }

//     const requestBody = {
//       userId: user.id,
//       status: "pending",
//       joined_at: new Date().toISOString(),
//     };

//     console.log("Posting to /join with values:", {
//       roomId: currentRoomId,
//       requestBody,
//     });

//     try {
//       const response = await fetch(`/api/rooms/${currentRoomId}/join`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(requestBody),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || "Failed to join room");
//       }

//       const data = await response.json();
//       toast.success(data.status === "pending" ? "Join request sent" : "Joined room successfully");
//     } catch (error) {
//       console.error("Join room error:", error);
//       toast.error(error instanceof Error ? error.message : "Failed to join room");
//     }
//   };

//   return (
//     <div className="h-20">
//       <div className="p-5 border-b flex items-center justify-between h-full">
//         <div>
//           <h1 className="text-xl font-bold">{selectedRoom ? selectedRoom.name : "Daily Chat"}</h1>
//           <ChatPresence />
//         </div>

//         <div className="flex items-center gap-2">
//           {user && (
//             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
//               <DialogTrigger asChild>
//                 <Button variant="outline" size="icon">
//                   <PlusCircle className="h-4 w-4" />
//                 </Button>
//               </DialogTrigger>
//               <DialogContent>
//                 <DialogHeader>
//                   <DialogTitle>Create New Room</DialogTitle>
//                   <DialogDescription>
//                     Create a new chat room. Private rooms require approval to join.
//                   </DialogDescription>
//                 </DialogHeader>
//                 <div className="grid gap-4 py-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="roomName">Room Name</Label>
//                     <Input
//                       id="roomName"
//                       placeholder="Enter room name"
//                       value={newRoomName}
//                       onChange={(e) => setNewRoomName(e.target.value)}
//                       disabled={isCreating}
//                     />
//                   </div>
//                   <div className="flex items-center space-x-2">
//                     <Switch
//                       id="private"
//                       checked={isPrivate}
//                       onCheckedChange={setIsPrivate}
//                       disabled={isCreating}
//                     />
//                     <Label htmlFor="private">Private Room</Label>
//                   </div>
//                 </div>
//                 <DialogFooter>
//                   <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
//                     Cancel
//                   </Button>
//                   <Button onClick={handleCreateRoom} disabled={isCreating}>
//                     {isCreating ? "Creating..." : "Create Room"}
//                   </Button>
//                 </DialogFooter>
//               </DialogContent>
//             </Dialog>
//           )}

//           <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
//             <PopoverTrigger asChild>
//               <Button variant="outline" size="icon">
//                 <Search className="h-4 w-4" />
//               </Button>
//             </PopoverTrigger>
//             <PopoverContent className="w-80">
//               <div className="p-4">
//                 <div className="flex justify-end mb-2">
//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     onClick={() => {
//                       setIsPopoverOpen(false);
//                       router.push("/profile");
//                     }}
//                   >
//                     <Settings className="h-4 w-4" />
//                   </Button>
//                 </div>
//                 <h3 className="font-semibold text-lg mb-2">Search</h3>
//                 <Input
//                   type="text"
//                   placeholder="Search..."
//                   value={searchQuery}
//                   onChange={handleSearchInputChange}
//                   className="mb-4"
//                 />
//                 <div className="flex gap-2 mb-4">
//                   <Button
//                     variant={searchType === "rooms" ? "default" : "outline"}
//                     onClick={() => handleSearchByType("rooms")}
//                   >
//                     Rooms
//                   </Button>
//                   <Button
//                     variant={searchType === "users" ? "default" : "outline"}
//                     onClick={() => handleSearchByType("users")}
//                   >
//                     Users
//                   </Button>
//                 </div>
//                 {searchResults.length > 0 && (
//                   <div className="mt-4">
//                     <h4 className="font-semibold text-sm mb-2">
//                       {searchType === "users" ? "User Profiles" : "Rooms"}
//                     </h4>
//                     <ul className="space-y-2">
//                       {searchResults.map((result) =>
//                         "username" in result ? (
//                           <li key={result.id} className="flex items-center justify-between">
//                             <div className="flex items-center gap-2">
//                               <Avatar>
//                                 {result.avatar_url ? (
//                                   <AvatarImage src={result.avatar_url} alt={result.username || "Avatar"} />
//                                 ) : (
//                                   <AvatarFallback>
//                                     {result.username?.charAt(0).toUpperCase() ||
//                                       result.display_name?.charAt(0).toUpperCase() ||
//                                       "?"}
//                                   </AvatarFallback>
//                                 )}
//                               </Avatar>
//                               <div>
//                                 <div className="text-xs text-gray-500">{result.username}</div>
//                                 <div className="text-sm font-semibold">{result.display_name}</div>
//                               </div>
//                             </div>
//                             <UserIcon className="h-4 w-4 text-gray-500" />
//                           </li>
//                         ) : (
//                           <li key={result.id} className="flex items-center justify-between">
//                             <div className="flex items-center gap-2">
//                               <span className="text-sm font-semibold">
//                                 {result.name} {result.is_private && "🔒"}
//                               </span>
//                             </div>
//                             <Button
//                               size="sm"
//                               onClick={() => handleJoinRoom(result.id)}
//                               disabled={!user}
//                             >
//                               Join
//                             </Button>
//                           </li>
//                         )
//                       )}
//                     </ul>
//                   </div>
//                 )}
//                 {searchResults.length === 0 && searchQuery.length > 0 && (
//                   <p className="text-sm text-muted-foreground mt-2">
//                     No {searchType || "results"} found matching your search.
//                   </p>
//                 )}
//                 {searchQuery.length === 0 && searchType && (
//                   <p className="text-sm text-muted-foreground mt-2">Start typing to search...</p>
//                 )}
//                 {isLoading && <p className="text-sm text-muted-foreground mt-2">Loading...</p>}
//               </div>
//             </PopoverContent>
//           </Popover>

//           {user && (
//             <>
//               <Button onClick={() => handleJoinRoom(selectedRoom?.id)}>Join Current Room</Button>
//               <Button onClick={handleLogout}>Logout</Button>
//             </>
//           )}
//           {!user && <Button onClick={handleLoginWithGithub}>Login</Button>}
//         </div>
//       </div>
//     </div>
//   );
// }



"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ChatPresence from "./ChatPresence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, User as UserIcon, Settings, PlusCircle, ArrowRight, LogOut, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Database } from "@/lib/types/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDebounce } from "use-debounce";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type SearchResult = UserProfile | Room;

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const supabase = supabaseBrowser();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  const checkRoomMembership = useCallback(async (roomId: string) => {
    if (!user) return false;
    
    const { data } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();
    
    return data?.status === "accepted";
  }, [user, supabase]);

  const handleRoomSwitch = async (room: Room) => {
    if (!user) {
      toast.error("You must be logged in to switch rooms");
      return;
    }

    try {
      const { error } = await supabase
        .from("room_members")
        .update({ active: true })
        .eq("user_id", user.id)
        .eq("room_id", room.id);

      if (error) throw error;

      await supabase
        .from("room_members")
        .update({ active: false })
        .eq("user_id", user.id)
        .neq("room_id", room.id);

      useRoomStore.getState().setSelectedRoom(room);
      setIsPopoverOpen(false);
      toast.success(`Switched to ${room.name}`);
    } catch (err) {
      toast.error("Failed to switch room");
      console.error(err);
    }
  };

const handleLeaveRoom = async () => {
  if (!user || !selectedRoom) {
    toast.error("No room selected");
    return;
  }

  setIsLeaving(true);
  try {
    const response = await fetch(`/api/rooms/${selectedRoom.id}/leave`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to leave room");
    }

    toast.success("Left room successfully");
    useRoomStore.getState().setSelectedRoom(null);
    router.refresh();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to leave room");
  } finally {
    setIsLeaving(false);
  }
};

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedCallback(e.target.value);
    setSearchQuery(e.target.value);
  };

  const fetchSearchResults = useCallback(async () => {
    if (!debouncedSearchQuery.trim() || !searchType) {
      setSearchResults([]);
      setIsLoading(false);
      
      try {
        const response = await fetch('/api/rooms/all');
        const data = await response.json();
        if (response.ok) {
          setSearchResults(data.rooms || []);
        } else {
          console.error(data.error || "Failed to fetch all rooms");
        }
      } catch (error) {
        console.error("Error fetching all rooms:", error);
      }
      
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/${searchType}/search?query=${encodeURIComponent(debouncedSearchQuery)}`);
      const data = await response.json();

      if (isMounted.current) {
        if (response.ok) {
          let results: SearchResult[] = [];
          if (searchType === "users") {
            results = Array.isArray(data) ? (data as UserProfile[]) : [];
          } else if (searchType === "rooms") {
            results = data.rooms && Array.isArray(data.rooms) ? (data.rooms as Room[]) : [];
          }
          setSearchResults(results);
        } else {
          toast.error(data.error || `Failed to search ${searchType}`);
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      if (isMounted.current) {
        toast.error("An error occurred while searching");
        setSearchResults([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearchQuery, searchType]);

  useEffect(() => {
    fetchSearchResults();
  }, [debouncedSearchQuery, searchType, fetchSearchResults]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedRoom && user) {
      checkRoomMembership(selectedRoom.id).then(setIsMember);
    }
  }, [selectedRoom, user, checkRoomMembership]);

  useEffect(() => {
    const channel = supabase
      .channel("rooms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        (payload) => {
          if (isMounted.current && payload.new) {
            useRoomStore.getState().setRooms(Array.isArray(payload.new) ? payload.new : [payload.new]);
          }
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "CLOSED") toast.error("Room subscription closed");
      });

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleCreateRoom = async () => {
    if (!user) {
      toast.error("You must be logged in to create a room");
      return;
    }

    if (!newRoomName.trim()) {
      toast.error("Room name cannot be empty");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_private: isPrivate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create room");
      }

      if (isMounted.current) {
        const { data: newRooms } = await supabase.from("rooms").select("*");
        useRoomStore.getState().setRooms(newRooms || []);
        const newRoom = newRooms?.find((room) => room.name === newRoomName.trim());
        if (newRoom) {
          await handleJoinRoom(newRoom.id);
        }
        toast.success("Room created successfully!");
        setNewRoomName("");
        setIsPrivate(false);
        setIsDialogOpen(false);
      }
    } catch (error) {
      if (isMounted.current) {
        toast.error(error instanceof Error ? error.message : "Failed to create room");
      }
    } finally {
      if (isMounted.current) {
        setIsCreating(false);
      }
    }
  };

  const handleLoginWithGithub = () => {
    supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: location.origin + "/auth/callback",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleSearchByType = (type: "rooms" | "users") => {
    setSearchType(type);
    setSearchQuery("");
  };

  const handleJoinRoom = async (roomId?: string) => {
    if (!user) {
      toast.error("You must be logged in to join a room");
      return;
    }

    const currentRoomId = roomId || selectedRoom?.id;
    if (!currentRoomId) {
      toast.error("No current room selected or invalid room ID");
      console.error("No valid roomId available:", { roomId, selectedRoom });
      return;
    }

    const { data: existingParticipation } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", currentRoomId)
      .eq("user_id", user.id)
      .single();

    if (existingParticipation && existingParticipation.status === "accepted") {
      toast.info("You are already a member of this room");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${currentRoomId}/join`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join room");
      }

      const data = await response.json();
      toast.success(data.status === "pending" ? "Join request sent" : "Joined room successfully");
    } catch (error) {
      console.error("Join room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
  };

  const renderRoomSearchResult = (result: Room) => (
    <li key={result.id} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">
          {result.name} {result.is_private && "🔒"}
        </span>
      </div>
      {selectedRoom?.id === result.id ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-700"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : isMember ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRoomSwitch(result)}
          className="flex items-center gap-1"
        >
          <ArrowRight className="h-4 w-4" />
          Switch
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
    <div className="h-20">
      <div className="p-5 border-b flex items-center justify-between h-full">
        <div>
          <h1 className="text-xl font-bold">
            {selectedRoom ? selectedRoom.name : "Daily Chat"}
          </h1>
          <ChatPresence />
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Room</DialogTitle>
                    <DialogDescription>
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
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRoom} disabled={isCreating}>
                      {isCreating ? "Creating..." : "Create Room"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {selectedRoom && (
                <>
                  {isMember ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPopoverOpen(true)}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Switch Room
                      </Button>
                    <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleLeaveRoom}
                          className="bg-red-600 hover:bg-red-700 flex items-center gap-1"
                          disabled={isLeaving}
                        >
                          {isLeaving ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Leaving...
                            </>
                          ) : (
                            <>
                              <LogOut className="h-4 w-4" />
                              Leave
                            </>
                          )}
                        </Button>
                                            </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => handleJoinRoom(selectedRoom.id)}
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        Join Room
                      </Button>
      </div>
    )}
  </>
)}
