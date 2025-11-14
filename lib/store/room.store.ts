// "use client";

// import { create } from "zustand";
// import { subscribeWithSelector, devtools } from "zustand/middleware";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { toast } from "sonner";

// export interface Room {
//   id: string;
//   name: string;
//   is_private: boolean;
//   created_by: string | null;
//   created_at: string;
//   isMember: boolean;
//   participationStatus: "pending" | "accepted" | null;
//   memberCount: number;
//   onlineCount?: number;
//   unreadCount?: number;
//   latestMessage?: string;
// }

// export interface RoomPresence {
//   onlineUsers: number;
//   userIds: string[];
//   lastUpdated: string;
// }

// interface RoomState {
//   userId: string | null;

//   rooms: Room[];
//   selectedRoomId: string | null;

//   presence: Record<string, RoomPresence>;

//   loading: boolean;
//   error: string | null;

//   // setters
//   setUserId: (id: string | null) => void;
//   setSelectedRoom: (id: string | null) => void;
//   setRooms: (rooms: Room[]) => void;
//   mergeRoom: (roomId: string, update: Partial<Room>) => void;

//   updatePresence: (roomId: string, presence: RoomPresence) => void;

//   fetchRooms: () => Promise<void>;
//   joinRoom: (roomId: string) => Promise<boolean>;
//   leaveRoom: (roomId: string) => Promise<boolean>;
//   createRoom: (name: string, isPrivate: boolean) => Promise<Room | null>;
// }

// export const useRoomStore = create<RoomState>()(
//   devtools(
//     subscribeWithSelector((set, get) => ({
//       userId: null,
//       rooms: [],
//       selectedRoomId: null,
//       presence: {},
//       loading: false,
//       error: null,

//       setUserId: (id) => set({ userId: id }),

//       setSelectedRoom: (roomId) => set({ selectedRoomId: roomId }),

//       setRooms: (rooms) => {
//         set({ rooms });

//         // auto-select default only if not already selected
//         const current = get().selectedRoomId;
//         if (!current && rooms.length > 0) {
//           const general = rooms.find((r) => r.name === "General Chat");
//           set({ selectedRoomId: general?.id ?? rooms[0].id });
//         }
//       },

//       mergeRoom: (roomId, update) =>
//         set((state) => ({
//           rooms: state.rooms.map((r) =>
//             r.id === roomId ? { ...r, ...update } : r
//           ),
//         })),

//       updatePresence: (roomId, presence) =>
//         set((state) => ({
//           presence: { ...state.presence, [roomId]: presence },
//         })),

//       fetchRooms: async () => {
//         const userId = get().userId;
//         if (!userId) return;

//         const supabase = getSupabaseBrowserClient();

//         try {
//           set({ loading: true });

//           const { data, error } = await supabase.rpc("get_rooms_with_counts", {
//             p_user_id: userId,
//             p_query: undefined,
//             p_include_participants: true,
//           });

//           if (error) throw error;

//           const rooms = (data || []).map((r: any): Room => ({
//             id: r.id,
//             name: r.name,
//             is_private: r.is_private,
//             created_by: r.created_by,
//             created_at: r.created_at,
//             isMember: r.is_member,
//             participationStatus: r.participation_status,
//             memberCount: r.member_count,
//           }));

//           get().setRooms(rooms);
//         } catch (err: any) {
//           set({ error: err.message });
//         } finally {
//           set({ loading: false });
//         }
//       },

//       joinRoom: async (roomId) => {
//         const userId = get().userId;
//         if (!userId) return false;
      
//         const supabase = getSupabaseBrowserClient();
      
//         try {
//           type JoinRoomResponse =
//             | { action: "joined_public_room" }
//             | { action: "join_request_sent" }
//             | { action: "owner_joined_private_room" }
//             | null;
      
//           const { data, error } = await supabase.rpc("join_room", {
//             p_room_id: roomId,
//             p_user_id: userId,
//           }) as { data: JoinRoomResponse; error: any };
      
//           if (error) throw error;
//           if (!data) return false;
      
//           switch (data.action) {
//             case "joined_public_room":
//               toast.success("Joined room!");
//               await get().fetchRooms();
//               set({ selectedRoomId: roomId });
//               return true;
      
//             case "join_request_sent":
//               toast.info("Join request sent!");
//               await get().fetchRooms();
//               return true;
      
//             case "owner_joined_private_room":
//               toast.success("Welcome to your private room!");
//               await get().fetchRooms();
//               set({ selectedRoomId: roomId });
//               return true;
      
//             default:
//               return false;
//           }
//         } catch (err: any) {
//           toast.error(err.message);
//           return false;
//         }
//       },
      
//       leaveRoom: async (roomId) => {
//         const userId = get().userId;
//         if (!userId) return false;

//         const supabase = getSupabaseBrowserClient();

//         try {
//           const { error } = await supabase.rpc("leave_room", {
//             p_room_id: roomId,
//             p_user_id: userId,
//           });

//           if (error) throw error;

//           if (get().selectedRoomId === roomId) {
//             set({ selectedRoomId: null });
//           }

//           await get().fetchRooms();
//           return true;
//         } catch {
//           return false;
//         }
//       },

//       createRoom: async (name, isPrivate) => {
//         try {
//           const res = await fetch("/api/rooms/create", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ name, isPrivate }),
//           });

//           const json = await res.json();

//           if (json.success && json.room) {
//             set((state) => ({ rooms: [...state.rooms, json.room] }));
//             return json.room;
//           }

//           return null;
//         } catch {
//           return null;
//         }
//       },
//     }))
//   )
// );

// // 🔥 Global utility to fetch all users for SearchComponent
// export const fetchAllUsers = async () => {
//     const supabase = getSupabaseBrowserClient();
  
//     const { data, error } = await supabase
//       .from("profiles")
//       .select("id, username, display_name, avatar_url, created_at");
  
//     if (error) {
//       console.error("fetchAllUsers error:", error);
//       return [];
//     }
  
//     return data || [];
//   };
  