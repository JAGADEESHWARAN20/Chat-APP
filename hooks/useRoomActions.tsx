// "use client";

// import { useUnifiedRoomStore } from "@/lib/store/roomstore";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// export function useRoomActions() {
//   return useUnifiedRoomStore((state) => ({
//     // Core room operations
//     setSelectedRoomId: state.setSelectedRoomId,
//     fetchRooms: state.fetchRooms,
//     createRoom: state.createRoom,
//     joinRoom: state.joinRoom,
//     leaveRoom: state.leaveRoom,
//     refreshRooms: state.refreshRooms,
//     forceRefreshRooms: state.forceRefreshRooms,
//     updateRoomMembership: state.updateRoomMembership,

//     // Messaging
//     sendMessage: state.sendMessage,

//     // User and UI state
//     setUser: state.setUser,
//     setLoading: state.setLoading,
//     setError: state.setError,
//     clearError: state.clearError,

//     // Presence
//     setRoomPresence: state.setRoomPresence,

//     // Typing system
//     updateTypingUsers: state.updateTypingUsers,
//     updateTypingText: state.updateTypingText,

//     // Helper
//     fetchAllUsers: async () => {
//       const supabase = getSupabaseBrowserClient();
//       const { data } = await supabase
//         .from("profiles")
//         .select("id, username, display_name, avatar_url, created_at");

//       return data || [];
//     },
//   }));
// }
