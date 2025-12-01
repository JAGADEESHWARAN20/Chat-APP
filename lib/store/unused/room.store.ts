// // lib/store/room.store.ts
// "use client";

// import { create } from "zustand";
// import { devtools, subscribeWithSelector } from "zustand/middleware";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { toast } from "sonner";

// /**
//  * Public Room type used by UI.
//  * Keep minimal so it's easy to map from RPC rows.
//  */
// export interface Room {
//   id: string;
//   name: string;
//   is_private: boolean;
//   created_by: string | null;
//   created_at: string;
//   isMember: boolean;
//   participationStatus: "pending" | "accepted" | null;
//   memberCount: number;
//   onlineUsers?: number;
//   unreadCount?: number;
//   latestMessage?: string | null;
// }

// export interface RoomPresence {
//   onlineUsers: number;
//   userIds: string[];
//   lastUpdated: string;
// }

// interface RoomState {
//   // auth
//   user: any | null;

//   // rooms and selection
//   availableRooms: Room[];
//   selectedRoomId: string | null;

//   // presence + misc
//   roomPresence: Record<string, RoomPresence>;

//   // UI state
//   isLoading: boolean;
//   error: string | null;

//   // setters/actions
//   setUser: (user: any | null) => void;
//   setAvailableRooms: (rooms: Room[]) => void;
//   setSelectedRoomId: (id: string | null) => void;
//   addRoom: (room: Room) => void;
//   updateRoom: (roomId: string, updates: Partial<Room>) => void;
//   removeRoom: (roomId: string) => void;
//   mergeRoomMembership: (roomId: string, updates: Partial<Room>) => void;

//   updateRoomPresence: (roomId: string, presence: RoomPresence) => void;

//   setLoading: (v: boolean) => void;
//   setError: (v: string | null) => void;
//   clearError: () => void;

//   // server ops
//   fetchRooms: () => Promise<void>;
//   joinRoom: (roomId: string) => Promise<boolean>;
//   leaveRoom: (roomId: string) => Promise<boolean>;
//   createRoom: (name: string, isPrivate: boolean) => Promise<Room | null>;
// }

// export const useRoomStore = create<RoomState>()(
//   devtools(
//     subscribeWithSelector((set, get) => ({
//       user: null,
//       availableRooms: [],
//       selectedRoomId: null,
//       roomPresence: {},
//       isLoading: false,
//       error: null,

//       setUser: (user) => set({ user }),

//       setAvailableRooms: (rooms) => {
//         set({ availableRooms: rooms });
//         // auto select default room only if none selected
//         const cur = get().selectedRoomId;
//         if (!cur && rooms.length > 0) {
//           const general = rooms.find((r) => r.name === "General Chat");
//           set({ selectedRoomId: general?.id ?? rooms[0].id });
//         }
//       },

//       setSelectedRoomId: (id) => set({ selectedRoomId: id }),

//       addRoom: (room) => set((s) => ({ availableRooms: [...s.availableRooms, room] })),

//       updateRoom: (roomId, updates) =>
//         set((s) => ({ availableRooms: s.availableRooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)) })),

//       removeRoom: (roomId) =>
//         set((s) => ({
//           availableRooms: s.availableRooms.filter((r) => r.id !== roomId),
//           selectedRoomId: s.selectedRoomId === roomId ? null : s.selectedRoomId,
//         })),

//       mergeRoomMembership: (roomId, updates) =>
//         set((s) => ({
//           availableRooms: s.availableRooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
//         })),

//       updateRoomPresence: (roomId, presence) => set((s) => ({ roomPresence: { ...s.roomPresence, [roomId]: presence } })),

//       setLoading: (v) => set({ isLoading: v }),
//       setError: (v) => set({ error: v }),
//       clearError: () => set({ error: null }),

//       // fetchRooms maps RPC output -> Room[]
//       fetchRooms: async () => {
//         const user = get().user;
//         if (!user) return;
//         const supabase = getSupabaseBrowserClient();
//         try {
//           set({ isLoading: true });
//           const { data, error } = await supabase.rpc("get_rooms_with_counts", {
//             p_user_id: user.id,
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
//             isMember: !!r.is_member,
//             participationStatus: r.participation_status ?? null,
//             memberCount: r.member_count ?? 0,
//             onlineUsers: r.online_users ?? 0,
//             unreadCount: r.unread_count ?? 0,
//             latestMessage: r.latest_message ?? null,
//           }));

//           get().setAvailableRooms(rooms);
//         } catch (err: any) {
//           console.error("fetchRooms error:", err);
//           set({ error: err?.message ?? "Failed to fetch rooms" });
//         } finally {
//           set({ isLoading: false });
//         }
//       },

//       // NOTE: supabase RPC join_room returns { action: "joined_public_room" | ... } or nonstandard
//       joinRoom: async (roomId) => {
//         const user = get().user;
//         if (!user) {
//           toast.error("Login required");
//           return false;
//         }
//         const supabase = getSupabaseBrowserClient();
//         try {
//           const resp = await supabase.rpc("join_room", {
//             p_room_id: roomId,
//             p_user_id: user.id,
//           }) as any;

//           // robust: check resp.data and resp.data.action safely
//           const payload = resp?.data ?? resp;
//           const action = payload?.action ?? null;

//           if (!payload) {
//             toast.error("Unexpected join response");
//             return false;
//           }

//           switch (action) {
//             case "joined_public_room":
//               toast.success("Joined room!");
//               await get().fetchRooms();
//               set({ selectedRoomId: roomId });
//               return true;

//             case "join_request_sent":
//               toast.info("Join request sent");
//               await get().fetchRooms();
//               return true;

//             case "owner_joined_private_room":
//               toast.success("Welcome to your private room!");
//               await get().fetchRooms();
//               set({ selectedRoomId: roomId });
//               return true;

//             default:
//               // if server returned something else, fallback to refetch
//               await get().fetchRooms();
//               return true;
//           }
//         } catch (err: any) {
//           console.error("joinRoom error:", err);
//           toast.error(err?.message ?? "Failed to join room");
//           return false;
//         }
//       },

//       leaveRoom: async (roomId) => {
//         const user = get().user;
//         if (!user) {
//           toast.error("Login required");
//           return false;
//         }
//         const supabase = getSupabaseBrowserClient();
//         try {
//           const { error } = await supabase.rpc("leave_room", {
//             p_room_id: roomId,
//             p_user_id: user.id,
//           });
//           if (error) throw error;

//           if (get().selectedRoomId === roomId) set({ selectedRoomId: null });
//           await get().fetchRooms();
//           return true;
//         } catch (err) {
//           console.error("leaveRoom error:", err);
//           toast.error("Failed to leave room");
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
//           if (json?.success && json.room) {
//             set((s) => ({ availableRooms: [...s.availableRooms, json.room] }));
//             return json.room;
//           }
//           throw new Error(json?.error ?? "Create failed");
//         } catch (err) {
//           console.error("createRoom error:", err);
//           toast.error("Failed to create room");
//           return null;
//         }
//       },
//     }))
//   )
// );

// /**
//  * Lightweight compatibility exports to avoid changing many imports across the codebase.
//  * - RoomProvider is a no-op for now (keep layout/components that expect provider).
//  * - Several selectors to be used by components.
//  */
// export function RoomProvider({ children }: { children: React.ReactNode }) {
//   return <>{children}</>;
// }

// export const useRoomContext = () => useRoomStore;
// export const useSelectedRoom = () => useRoomStore((s) => s.availableRooms.find((r) => r.id === s.selectedRoomId) ?? null);
// export const useAvailableRooms = () => useRoomStore((s) => s.availableRooms);
// export const useRoomLoading = () => useRoomStore((s) => s.isLoading);
// export const useRoomError = () => useRoomStore((s) => s.error);
// export const useRoomPresence = () => useRoomStore((s) => s.roomPresence);

// export const useRoomActions = () =>
//   useRoomStore((s) => ({
//     setUser: s.setUser,
//     setAvailableRooms: s.setAvailableRooms,
//     setSelectedRoomId: s.setSelectedRoomId,
//     addRoom: s.addRoom,
//     updateRoom: s.updateRoom,
//     removeRoom: s.removeRoom,
//     mergeRoomMembership: s.mergeRoomMembership,
//     updateRoomPresence: s.updateRoomPresence,
//     fetchRooms: s.fetchRooms,
//     joinRoom: s.joinRoom,
//     leaveRoom: s.leaveRoom,
//     createRoom: s.createRoom,
//   }));

// // small helper used by SearchComponent etc.
// export const fetchAllUsers = async () => {
//   const supabase = getSupabaseBrowserClient();
//   const { data, error } = await supabase.from("profiles").select("id, username, display_name, avatar_url, created_at");
//   if (error) {
//     console.error("fetchAllUsers error:", error);
//     return [];
//   }
//   return data || [];
// };
