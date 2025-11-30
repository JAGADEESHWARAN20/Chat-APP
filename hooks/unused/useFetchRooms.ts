// import { useCallback } from "react";
// import { toast } from "@/components/ui/sonner"
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { Database } from "@/lib/types/supabase";

// type Room = Database["public"]["Tables"]["rooms"]["Row"];
// type RoomWithMembership = Room & {
//   isMember: boolean;
//   participationStatus: string | null;
// };

// export const useFetchRooms = (
//   user: { id: string } | undefined,
//   checkRoomMembership: (roomId: string) => Promise<boolean>,
//   checkRoomParticipation: (roomId: string) => Promise<string | null>,
//   setAvailableRooms: (rooms: RoomWithMembership[]) => void,
//   setRooms: (rooms: RoomWithMembership[]) => void,
//   isMounted: React.MutableRefObject<boolean>,
//   initializeDefaultRoom?: () => void
// ) => {
//   const supabase = getSupabaseBrowserClient();

//   const fetchAvailableRooms = useCallback(async () => {
//     if (!user) {
//       setAvailableRooms([]);
//       setRooms([]);
//       return;
//     }

//     try {
//       let rooms: Room[] = [];

//       // Fetch rooms where user is an accepted member
//       const { data: memberships, error: memberError } = await supabase
//         .from("room_members")
//         .select("room_id")
//         .eq("user_id", user.id)
//         .eq("status", "accepted");

//       if (memberError && memberError.code !== "PGRST116") {
//         toast.error("Failed to fetch room memberships");
//         console.error("Room membership fetch error:", memberError);
//         if (isMounted.current) {
//           setAvailableRooms([]);
//           setRooms([]);
//         }
//         return;
//       }

//       const roomIds = memberships?.map((m) => m.room_id) ?? [];

//       if (roomIds.length > 0) {
//         const { data: joinedRooms, error: joinedError } = await supabase
//           .from("rooms")
//           .select("*")
//           .in("id", roomIds);

//         if (joinedError) {
//           toast.error("Failed to fetch rooms");
//           console.error("Error fetching joined rooms:", joinedError);
//           if (isMounted.current) {
//             setAvailableRooms([]);
//             setRooms([]);
//           }
//           return;
//         }

//         rooms = joinedRooms || [];
//       }

//       // Fallback: Ensure General Chat exists if no rooms are found
//       if (rooms.length === 0) {
//         const { data: generalRoom, error: generalError } = await supabase
//           .from("rooms")
//           .select("*")
//           .eq("name", "General Chat")
//           .eq("is_private", false)
//           .single();

//         let roomToUse: Room | null = generalRoom ?? null;

//         if (!roomToUse && generalError?.code === "PGRST116") {
//           const { data: newRoom, error: createError } = await supabase
//             .from("rooms")
//             .upsert(
//               {
//                 name: "General Chat",
//                 is_private: false,
//                 created_by: user.id,
//                 created_at: new Date().toISOString(),
//               },
//               { onConflict: "name,is_private" }
//             )
//             .select()
//             .single();

//           if (createError || !newRoom) {
//             toast.error("Failed to create General Chat room");
//             console.error("Error creating General Chat:", createError);
//             if (isMounted.current) {
//               setAvailableRooms([]);
//               setRooms([]);
//             }
//             return;
//           }

//           roomToUse = newRoom;
//         }

//         if (roomToUse) {
//           const isMember = await checkRoomMembership(roomToUse.id);
//           if (!isMember) {
//             const { error: joinError } = await supabase
//               .from("room_members")
//               .insert({
//                 room_id: roomToUse.id,
//                 user_id: user.id,
//                 status: "accepted",
//                 joined_at: new Date().toISOString(),
//                 active: true,
//               });

//             if (joinError && joinError.code !== "23505") {
//               toast.error("Failed to join General Chat");
//               console.error("Join General Chat error:", joinError);
//               if (isMounted.current) {
//                 setAvailableRooms([]);
//                 setRooms([]);
//               }
//               return;
//             }
//           }

//           rooms = [roomToUse];
//         }
//       }

//       // Enrich rooms with membership and participation details
//       const enrichedRooms: RoomWithMembership[] = await Promise.all(
//         rooms.map(async (room) => ({
//           ...room,
//           isMember: await checkRoomMembership(room.id),
//           participationStatus: await checkRoomParticipation(room.id),
//         }))
//       );

//       if (isMounted.current) {
//         setAvailableRooms(enrichedRooms);
//         setRooms(enrichedRooms);
//         if (initializeDefaultRoom) initializeDefaultRoom();
//       }
//     } catch (error) {
//       toast.error("Something went wrong while fetching rooms");
//       console.error("Room fetch error:", error);
//       if (isMounted.current) {
//         setAvailableRooms([]);
//         setRooms([]);
//       }
//     }
//   }, [
//     user,
//     supabase,
//     checkRoomMembership,
//     checkRoomParticipation,
//     setAvailableRooms,
//     setRooms,
//     isMounted,
//     initializeDefaultRoom,
//   ]);

//   return { fetchAvailableRooms };
// };