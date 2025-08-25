// "use client";

// import { useRef, useEffect } from "react";
// import { useRoomStore } from "../store/roomstore";
// import { supabaseBrowser } from "@/lib/supabase/browser";
// import { useUser } from "@/lib/store/user";
// import { toast } from "sonner";
// import { Database } from "@/lib/types/supabase";

// type Room = Database["public"]["Tables"]["rooms"]["Row"];
// type RoomWithMembership = Room & {
//      isMember: boolean;
//      participationStatus: string | null;
// };

// // Define IRoom to match Room, assuming it's the same structure
// interface IRoom extends Room { }

// const transformRooms = async (
//      rooms: IRoom[],
//      userId: string,
//      supabase: ReturnType<typeof supabaseBrowser>
// ): Promise<RoomWithMembership[]> => {
//      try {
//           const { data: participations, error } = await supabase
//                .from("room_participants")
//                .select("*")
//                .eq("user_id", userId);

//           if (error) {
//                throw new Error("Failed to fetch room participations");
//           }

//           return rooms.map((room) => ({
//                ...room,
//                isMember: participations?.some((p) => p.room_id === room.id && p.status === "accepted") || false,
//                participationStatus: participations?.find((p) => p.room_id === room.id)?.status || null,
//           }));
//      } catch (error) {
//           throw error;
//      }
// };

// function InitRoom({ rooms }: { rooms: IRoom[] }) {
//      const initState = useRef(false);
//      const user = useUser((state) => state.user);
//      const supabase = supabaseBrowser();

//      useEffect(() => {
//           if (!initState.current && user) {
//                const initialize = async () => {
//                     try {
//                          const transformedRooms = await transformRooms(rooms, user.id, supabase);
//                          useRoomStore.setState({ rooms: transformedRooms });
//                     } catch (error) {
//                          console.error("Error transforming rooms:", error);
//                          toast.error(error instanceof Error ? error.message : "Failed to initialize rooms");
//                     }
//                };

//                initialize();
//                initState.current = true;
//           }
//      }, [rooms, user, supabase]); // Dependencies are fine since initState prevents re-runs

//      return null;
// }

// export default InitRoom;