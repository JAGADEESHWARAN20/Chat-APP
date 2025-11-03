// "use client";

// import { useEffect, useCallback, useRef } from "react";
// import { debounce } from "lodash";
// import { toast } from "sonner";

// import { supabaseBrowser } from "@/lib/supabase/browser";
// import { useUser } from "@/lib/store/user";
// import { useRoomStore } from "@/lib/store/roomstore";
// import { useRoomContext } from "@/lib/store/RoomContext"; // Assuming this is the correct path
// import { useFetchRooms } from "@/hooks/useFetchRooms";



// export default function RoomInitializer() {
//   const supabase = supabaseBrowser();
//   const user = useUser((state) => state.user);
//   const { setRooms, initializeDefaultRoom } = useRoomStore();
//   const { joinRoom: setCurrentRoom } = useRoomContext();
//   const isMounted = useRef(true);
//   const initializationInProgress = useRef(false);

//   const checkRoomMembership = useCallback(
//     async (roomId: string) => {
//       if (!user) return false;
//       const { data, error } = await supabase
//         .from("room_members")
//         .select("status")
//         .eq("room_id", roomId)
//         .eq("user_id", user.id)
//         .eq("status", "accepted")
//         .single();

//       if (error && error.code !== "PGRST116") {
//         console.error("Error checking room membership:", error);
//         return false;
//       }
//       return data?.status === "accepted";
//     },
//     [user, supabase]
//   );

//   const checkRoomParticipation = useCallback(
//     async (roomId: string) => {
//       if (!user) return null;
//       const { data, error } = await supabase
//         .from("room_participants")
//         .select("status")
//         .eq("room_id", roomId)
//         .eq("user_id", user.id)
//         .single();

//       if (error && error.code !== "PGRST116") {
//         console.error("Error checking room participation:", error);
//         return null;
//       }
//       return data?.status || null;
//     },
//     [user, supabase]
//   );

//   const { fetchAvailableRooms } = useFetchRooms(
//     user,
//     checkRoomMembership,
//     checkRoomParticipation,
//     setRooms,
//     setRooms,
//     isMounted,
//     initializeDefaultRoom
//   );

//   const initializeRooms = useCallback(async () => {
//     if (initializationInProgress.current || !user) return;
//     initializationInProgress.current = true;

//     try {
//       const timestamp = new Date().toISOString();
//       const { data: existingRoom, error: checkError } = await supabase
//         .from("rooms")
//         .select("*")
//         .eq("name", "General Chat")
//         .eq("is_private", false)
//         .single();

//       let roomId: string;

//       if (checkError && checkError.code !== "PGRST116") {
//         console.error("Error checking for General Chat:", checkError);
//         throw checkError;
//       }

//       if (!existingRoom) {
//         const { data: newRoom, error: createError } = await supabase.rpc(
//           "create_room_with_member",
//           {
//             p_name: "General Chat",
//             p_is_private: false,
//             p_user_id: user.id,
//             p_timestamp: timestamp,
//           }
//         );

//         if (createError) {
//           if (createError.code === "23505") {
//             await fetchAvailableRooms();
//             initializationInProgress.current = false;
//             return;
//           }
//           throw createError;
//         }

//         roomId = newRoom?.[0]?.id;
//       } else {
//         roomId = existingRoom.id;

//         const isMember = await checkRoomMembership(roomId);
//         if (!isMember) {
//           const { error: joinError } = await supabase
//             .from("room_members")
//             .insert({
//               room_id: roomId,
//               user_id: user.id,
//               status: "accepted",
//               joined_at: timestamp,
//               active: true,
//             });

//           if (joinError && joinError.code !== "23505") {
//             throw joinError;
//           }
//         }
//       }

//       // Set current room and persist to localStorage
//       setCurrentRoom(roomId);
//       localStorage.setItem("activeRoom", roomId);

//       // Fetch all rooms
//       await fetchAvailableRooms();

//       if (initializeDefaultRoom) initializeDefaultRoom();
//     } catch (error) {
//       console.error("[RoomInitializer] Initialization error:", error);
//       toast.error("Room initialization failed.");
//       setRooms([]);
//     } finally {
//       initializationInProgress.current = false;
//     }
//   }, [
//     user,
//     supabase,
//     fetchAvailableRooms,
//     setRooms,
//     initializeDefaultRoom,
//     checkRoomMembership,
//     setCurrentRoom,
//   ]);

//   useEffect(() => {
//     if (!user) {
//       setRooms([]);
//       return;
//     }

//     const debouncedInit = debounce(() => {
//       if (isMounted.current && user) initializeRooms();
//     }, 300);

//     debouncedInit();

//     const roomChannel = supabase
//       .channel("room_members_changes")
//       .on(
//         "postgres_changes",
//         {
//           event: "*",
//           schema: "public",
//           table: "room_members",
//           filter: `user_id=eq.${user.id}`,
//         },
//         (payload) => {
//           console.log("Room membership change detected:", payload);
//           if (isMounted.current) fetchAvailableRooms();
//         }
//       )
//       .subscribe((status) => {
//         console.log("Room subscription status:", status);
//       });

//     return () => {
//       isMounted.current = false;
//       roomChannel.unsubscribe();
//       debouncedInit.cancel();
//     };
//   }, [user, setRooms, supabase, fetchAvailableRooms, initializeRooms]);

//   return null;
// }