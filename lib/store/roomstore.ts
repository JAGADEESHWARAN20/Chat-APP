// lib/store/unified-room-store.ts
"use client";

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner"
import type { Database } from "@/lib/types/supabase";
import { useEffect } from "react";

type IRoomRow = Database["public"]["Tables"]["rooms"]["Row"];

type RoomParticipantRecord = {
  id: string;
  room_id: string;
  user_id: string;
  status: "pending" | "accepted" | "left" | string;
  created_at?: string;
  updated_at?: string;
};


// add created_by to the type
export type RoomWithMembership = IRoomRow & {
  created_by?: string | null;   // <-- new
  isMember: boolean;
  participationStatus: "pending" | "accepted" | null;
  memberCount: number;
  online_users?: number;
  unreadCount?: number;
  latestMessage?: string | null;
};


export interface RoomPresence {
  onlineUsers: number;
  userIds: string[];
  lastUpdated?: string;
}

export interface TypingUser {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
}

interface RoomState {
  user: { id: string } | null;
  rooms: RoomWithMembership[];
  selectedRoomId: string | null;
  roomPresence: Record<string, RoomPresence>;
  typingUsers: TypingUser[];
  typingDisplayText: string;
  isLoading: boolean;
  error: string | null;

  // Setters
  setUser: (u: { id: string } | null) => void;
  setRooms: (rooms: RoomWithMembership[]) => void;
  setSelectedRoomId: (id: string | null) => void;
  setRoomPresence: (roomId: string, p: RoomPresence) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setAvailableRooms: (rooms: RoomWithMembership[]) => void;
  addRoom: (room: RoomWithMembership) => void;
  updateRoom: (roomId: string, updates: Partial<RoomWithMembership>) => void;
  removeRoom: (roomId: string) => void;
  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;
  clearError: () => void;

  // Core operations
  fetchRooms: (opts?: { force?: boolean }) => Promise<RoomWithMembership[] | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  createRoom: (name: string, isPrivate: boolean) => Promise<RoomWithMembership | null>;
  sendMessage: (roomId: string, text: string) => Promise<boolean>;
  
  // Instant sync operations
  updateRoomMembership: (roomId: string, updates: Partial<RoomWithMembership>) => void;
  mergeRoomMembership: (roomId: string, updates: Partial<RoomWithMembership>) => void;
  refreshRooms: () => Promise<void>;
}


// in normalizeRpcRooms - map owner field from RPC payload
const normalizeRpcRooms = (rows: any[]): RoomWithMembership[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    is_private: r.is_private,
    created_by: r.created_by,
    created_at: r.created_at,

    // from room_overview
    memberCount: r.member_count ?? 0,
    latestMessage: r.latest_message ?? null,
    latest_message_created_at: r.latest_message_created_at ?? null,

    // membership info
    isMember: Boolean(r.is_member),
    participationStatus: r.participation_status ?? null,

    // optional fields – keep existing support
    unreadCount: r.unread_count ?? 0,
    online_users: r.online_users ?? 0,
  }));


const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// Create the unified store
export const useUnifiedRoomStore = create<RoomState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      user: null,
      rooms: [],
      selectedRoomId: null,
      roomPresence: {},
      typingUsers: [],
      typingDisplayText: "",
      isLoading: false,
      error: null,

      // 🎯 SETTERS
      setUser: (u) => set({ user: u }),
      
      setRooms: (rooms) => {
        console.log('🚀 setRooms - Updating store with', rooms.length, 'rooms');
        set({ rooms });
        const sel = get().selectedRoomId;
        if (!sel && rooms.length > 0) {
          const defaultRoom = rooms.find((r) => r.name === "General Chat") ?? rooms[0];
          set({ selectedRoomId: defaultRoom?.id ?? null });
        }
      },
      
      setSelectedRoomId: (id) => set({ selectedRoomId: id }),
      
      setRoomPresence: (roomId, p) =>
        set((s) => ({ roomPresence: { ...s.roomPresence, [roomId]: p } })),
      
      setLoading: (v) => set({ isLoading: v }),
      
      setError: (v) => set({ error: v }),
      
      setAvailableRooms: (rooms) => set({ rooms }),
      
      addRoom: (room) =>
        set((state) => ({ rooms: [...state.rooms, room] })),
      
      updateRoom: (roomId, updates) =>
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          ),
        })),
      
      removeRoom: (roomId) =>
        set((state) => ({
          rooms: state.rooms.filter((room) => room.id !== roomId),
          selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId,
        })),
      
      updateTypingUsers: (users) => set({ typingUsers: users }),
      
      updateTypingText: (text) => set({ typingDisplayText: text }),
      
      clearError: () => set({ error: null }),

      // 🎯 INSTANT OPTIMISTIC UPDATES
      updateRoomMembership: (roomId, updates) => {
        console.log('⚡ updateRoomMembership - Instant update for room:', roomId, updates);
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          ),
        }));
      },

      mergeRoomMembership: (roomId, updates) => {
        console.log('⚡ mergeRoomMembership - Merging updates for room:', roomId, updates);
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          ),
        }));
      },

      refreshRooms: async (): Promise<void> => {
        console.log('🔄 refreshRooms - Forcing refresh');
        await get().fetchRooms({ force: true });
      },

      // 🎯 CORE OPERATIONS
      fetchRooms: async ({ force = false } = {}) => {
        const supabase = getSupabaseBrowserClient();
        let userId = get().user?.id;
        
        try {
         
          if (!userId) return null;
          
          // Skip if we have data and not forcing refresh
          if (!force && get().rooms.length > 0) {
            console.log('📦 fetchRooms - Using cached data');
            return get().rooms;
          }

          set({ isLoading: true, error: null });
          console.log('🌐 fetchRooms - Fetching from server');

          const { data, error } = await supabase.rpc("get_rooms_with_counts", {
            p_user_id: userId,
            p_query: null as any,
            
          });

          if (error) {
            console.error("❌ fetchRooms RPC error:", error);
            set({ error: error.message ?? "Failed to fetch rooms" });
            return null;
          }

          const formatted = normalizeRpcRooms(data);
          console.log('✅ fetchRooms - Success:', {
            total: formatted.length,
            joined: formatted.filter(r => r.isMember && r.participationStatus === 'accepted').length,
            pending: formatted.filter(r => r.participationStatus === 'pending').length
          });
          
          set({ rooms: formatted });
          
          // Auto-select first room if none selected
          const sel = get().selectedRoomId;
          if (!sel && formatted.length > 0) {
            const defaultRoom = formatted.find((r) => r.name === "General Chat") ?? formatted[0];
            set({ selectedRoomId: defaultRoom?.id ?? null });
          }
          
          return formatted;
        } catch (err: any) {
          console.error("❌ fetchRooms error:", err);
          set({ error: err.message ?? "Failed to fetch rooms" });
          return null;
        } finally {
          set({ isLoading: false });
        }
      },

      sendMessage: async (roomId: string, text: string) => {
        try {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, text }),
          });
          return res.ok;
        } catch {
          return false;
        }
      },

      joinRoom: async (roomId) => {
  const room = get().rooms.find(r => r.id === roomId);
  const currentUserId = get().user?.id;
  const isOwner = room?.created_by && currentUserId && room.created_by === currentUserId;

  console.log('🎯 joinRoom - Starting for room:', roomId, 'Current status:', room?.participationStatus, 'isOwner:', isOwner);

  // INSTANT OPTIMISTIC UPDATE
  if (room?.is_private && !isOwner) {
    get().updateRoomMembership(roomId, { participationStatus: "pending" });
    toast.info("Join request sent — awaiting approval");
  } else if (room) {
    get().updateRoomMembership(roomId, { 
      isMember: true, 
      participationStatus: "accepted", 
      memberCount: (room.memberCount || 0) + 1 
    });
    toast.success("Joined room successfully!");
  }

  try {
    const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST", headers: { "Content-Type": "application/json" } });
    const json = await safeJson(res);

    if (!res.ok) {
      // rollback to previous room object values
      if (room) {
        get().updateRoomMembership(roomId, {
          isMember: room.isMember,
          participationStatus: room.participationStatus,
          memberCount: room.memberCount
        });
      }
      toast.error(json?.error || "Failed to join room");
      return false;
    }

    // Refresh canonical state (small delay to allow DB triggers to fire)
    setTimeout(() => get().refreshRooms(), 500);
    return true;
  } catch (err: any) {
    console.error("❌ joinRoom error:", err);
    if (room) {
      get().updateRoomMembership(roomId, {
        isMember: room.isMember,
        participationStatus: room.participationStatus,
        memberCount: room.memberCount
      });
    }
    toast.error("Failed to join room");
    return false;
  }
},


      leaveRoom: async (roomId) => {
        const room = get().rooms.find(r => r.id === roomId);
        console.log('🚪 leaveRoom - Starting for room:', roomId);

        // INSTANT OPTIMISTIC UPDATE
        if (room) {
          get().updateRoomMembership(roomId, { 
            isMember: false, 
            participationStatus: null, 
            memberCount: Math.max(0, room.memberCount - 1) 
          });
          if (get().selectedRoomId === roomId) set({ selectedRoomId: null });
          toast.success("Left room successfully");
        }

        try {
          const res = await fetch(`/api/rooms/${roomId}/leave`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" } 
          });
          const json = await safeJson(res);

          if (!res.ok) {
            // Rollback optimistic update on error
            if (room) {
              get().updateRoomMembership(roomId, { 
                isMember: room.isMember, 
                participationStatus: room.participationStatus, 
                memberCount: room.memberCount 
              });
            }
            toast.error(json?.error || "Failed to leave room");
            return false;
          }

          // Refresh to get canonical state
          setTimeout(() => get().refreshRooms(), 1000);
          return true;
        } catch (err: any) {
          console.error("❌ leaveRoom error:", err);
          // Rollback on error
          if (room) {
            get().updateRoomMembership(roomId, { 
              isMember: room.isMember, 
              participationStatus: room.participationStatus, 
              memberCount: room.memberCount 
            });
          }
          toast.error("Failed to leave room");
          return false;
        }
      },

      createRoom: async (name, isPrivate) => {
        try {
          const res = await fetch("/api/rooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, isPrivate }),
          });
          const json = await safeJson(res);
          if (!res.ok) {
            toast.error(json?.error || "Failed to create room");
            return null;
          }

          await get().refreshRooms();
          const created = get().rooms.find((r) => r.name === name) ?? null;
          if (created) {
            toast.success("Room created");
            return created;
          }
          return null;
        } catch (err: any) {
          console.error("❌ createRoom error:", err);
          toast.error("Failed to create room");
          return null;
        }
      },
    }))
  )
);

/* 🚀 HIGH-PERFORMANCE SELECTORS */
export const useAvailableRooms = () => useUnifiedRoomStore((s) => s.rooms);
export const useJoinedRooms = () => 
  useUnifiedRoomStore((s) => s.rooms.filter((r) => r.isMember && r.participationStatus === "accepted"));
export const useSelectedRoom = () => 
  useUnifiedRoomStore((s) => s.rooms.find((r) => r.id === s.selectedRoomId) ?? null);
export const useRoomLoading = () => useUnifiedRoomStore((s) => s.isLoading);
export const useRoomError = () => useUnifiedRoomStore((s) => s.error);
export const useRoomPresence = () => useUnifiedRoomStore((s) => s.roomPresence);
export const useTypingUsers = () => useUnifiedRoomStore((s) => s.typingUsers);
export const useTypingDisplayText = () => useUnifiedRoomStore((s) => s.typingDisplayText);

export const useRoomActions = () =>
  useUnifiedRoomStore((s) => ({
    // Setters
    setSelectedRoomId: s.setSelectedRoomId,
    setAvailableRooms: s.setAvailableRooms,
    setUser: s.setUser,
    setLoading: s.setLoading,
    setError: s.setError,
    clearError: s.clearError,
    
    // Room operations
    fetchRooms: s.fetchRooms,
    joinRoom: s.joinRoom,
    leaveRoom: s.leaveRoom,
    createRoom: s.createRoom,
    sendMessage: s.sendMessage,
    
    // Sync operations
    refreshRooms: s.refreshRooms,
    updateRoomMembership: s.updateRoomMembership,
    mergeRoomMembership: s.mergeRoomMembership,
    
    // Typing
    updateTypingUsers: s.updateTypingUsers,
    updateTypingText: s.updateTypingText,
    
    // Room management
    addRoom: s.addRoom,
    updateRoom: s.updateRoom,
    removeRoom: s.removeRoom,
    setRoomPresence: s.setRoomPresence,
  }));

// Real-time sync hook
export const useRoomRealtimeSync = (userId: string | null) => {
  const { refreshRooms, updateRoomMembership } = useRoomActions();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!userId) return;

    console.log('🔌 useRoomRealtimeSync - Setting up for user:', userId);
    const channel = supabase.channel(`global-room-sync-${userId}`);

    const handleParticipantChange = async (payload: any) => {
      const { eventType, new: newRecord } = payload;
      const roomId = newRecord?.room_id;
      
      if (!roomId) return;

      console.log('📢 Real-time participant change:', { eventType, roomId, status: newRecord?.status });

      // INSTANT UI UPDATE - No waiting for refresh
      if (eventType === 'UPDATE' && newRecord?.status === 'accepted') {
        console.log('⚡ INSTANT UPDATE - User accepted to room:', roomId);
        updateRoomMembership(roomId, { 
          isMember: true, 
          participationStatus: "accepted" 
        });
        toast.success("🎉 You're now a member of this room!");
      }
      
      
    };

    const handleNotification = async (payload: any) => {
      const { new: newRecord } = payload;
      
      if (newRecord?.type === 'join_request_accepted' && newRecord.room_id) {
        console.log('📢 Real-time notification - Join request accepted for room:', newRecord.room_id);
        // INSTANT UI UPDATE
        updateRoomMembership(newRecord.room_id, { 
          isMember: true, 
          participationStatus: "accepted" 
        });
        toast.success("🎉 Your join request was accepted!");
        
        // Refresh for complete data
        setTimeout(() => refreshRooms(), 500);
      }
    };
    // Real-time Presence Sync For Each Room


    channel
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_participants" },
      (payload) => {
        const rec = payload.new as RoomParticipantRecord;
      
        if (!rec) return;
    
        if (rec.user_id !== userId) return; // client-side filter ONLY
    
        if (rec.status === "accepted") {
          updateRoomMembership(rec.room_id, {
            isMember: true,
            participationStatus: "accepted",
          });
          toast.success("🎉 You're now a member of this room!");
        }
    
        if (rec.status === "pending") {
          updateRoomMembership(rec.room_id, {
            isMember: false,
            participationStatus: "pending",
          });
        }
    
        if (rec.status === "left") {
          updateRoomMembership(rec.room_id, {
            isMember: false,
            participationStatus: null,
          });
        }
      }
    )
    
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        handleNotification
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshRooms, updateRoomMembership, supabase]);
};


// Helper function for fetching users
export const fetchAllUsers = async () => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at");
  return data || [];
};