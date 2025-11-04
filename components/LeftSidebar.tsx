"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
// import { debounce } from "lodash";
import { 
  useSelectedRoom, 
  useAvailableRooms, 
  useRoomActions,
  useRoomLoading,
  type Room 
} from "@/lib/store/RoomContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ChevronRight, MessageSquare, Users, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";  
import { toast } from "sonner";

interface LeftSidebarProps {
  user: { id: string } | null;
  isOpen: boolean;
  onClose?: () => void;
}

// ✅ FIXED: Define the extended room type locally
type RoomWithMembershipCount = Room & {
  isMember?: boolean;
  memberCount?: number;
  onlineUsers?: number;
  participationStatus?: 'pending' | 'accepted';
  unreadCount?: number;
  latestMessage?: string;
};

const LeftSidebar = React.memo<LeftSidebarProps>(({ user, isOpen, onClose }) => {
  // ✅ FIXED: Use Zustand selectors
  const selectedRoom = useSelectedRoom();
  const availableRooms = useAvailableRooms();
  const isLoading = useRoomLoading();
  const { setSelectedRoom, createRoom, fetchRooms } = useRoomActions();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // ✅ FIXED: Better debounce implementation
  const debouncedSearchRef = useRef<NodeJS.Timeout | null>(null);

  const joinedRooms = useMemo(() => {
    const filtered = availableRooms.filter((room) => 
      room.isMember && room.participationStatus === "accepted"
    );
    
    console.log("[LeftSidebar] Joined rooms:", {
      totalAvailable: availableRooms.length,
      joinedCount: filtered.length,
      joinedRooms: filtered.map(r => ({ id: r.id, name: r.name, isMember: r.isMember, status: r.participationStatus }))
    });
    
    return filtered;
  }, [availableRooms]);

  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return joinedRooms;
    
    const searchLower = searchTerm.toLowerCase();
    return joinedRooms.filter((room) =>
      room.name.toLowerCase().includes(searchLower)
    );
  }, [joinedRooms, searchTerm]);

  // Empty direct chats (extend later)
  const directChats = useMemo<RoomWithMembershipCount[]>(() => [], []);
  const filteredChats = useMemo(() => 
    directChats.filter((chat) =>
      chat.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), 
    [directChats, searchTerm]
  );

  // ✅ FIXED: Proper debounced search implementation
  const handleSearchChange = useCallback((value: string) => {
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
    }
    
    debouncedSearchRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSearchChange(e.target.value);
  }, [handleSearchChange]);

  const handleCreateRoom = useCallback(async () => {
    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      toast.error("Room name cannot be empty");
      return;
    }
    
    setIsCreating(true);
    try {
      await createRoom(trimmedName, false);
      setNewRoomName("");
      setShowCreateRoom(false);
      toast.success("Room created!");
      await fetchRooms();
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  }, [newRoomName, createRoom, fetchRooms]);

  // ✅ FIXED: Stable render function with proper dependencies
  const renderItem = useCallback((item: RoomWithMembershipCount) => {
    const memberCount = item.memberCount ?? 0;
    const onlineCount = item.onlineUsers ?? 0;

    return (
      <div
        key={item.id}
        className={`flex items-start p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
          selectedRoom?.id === item.id
            ? "bg-primary/10 dark:bg-primary/20"
            : "hover:bg-muted"
        }`}
        onClick={() => setSelectedRoom(item)}
      >
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarFallback className="bg-muted">
            {item.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-foreground truncate">
              #{item.name}
            </div>
            {(item.unreadCount ?? 0) > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-1">
                {item.unreadCount! > 99 ? '99+' : item.unreadCount}
              </span>
            )}
          </div>

          <div className="text-sm text-muted-foreground truncate mb-2">
            {item.latestMessage || "No messages yet"}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              {onlineCount > 0 && (
                <span className="text-green-600 ml-1">({onlineCount} online)</span>
              )}
            </div>
            <div className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1">
              Joined
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-1">
            Created: {new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }, [selectedRoom?.id, setSelectedRoom]);

  // ✅ FIXED: Proper cleanup
  useEffect(() => {
    return () => {
      if (debouncedSearchRef.current) {
        clearTimeout(debouncedSearchRef.current);
      }
    };
  }, []);

  if (!user) {
    return (
      <div className="fixed lg:static inset-y-0 left-0 w-full lg:w-1/4 px-4 py-3 bg-card border-r h-screen flex flex-col transition-transform duration-300 z-50">
        <p className="text-muted-foreground p-4">Please log in to view rooms</p>
      </div>
    );
  }

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 w-full lg:w-1/4 px-4 py-3 bg-card border-r h-screen flex flex-col transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } z-50`}
    >
      <Tabs defaultValue="rooms" className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rooms">My Rooms</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Button>
          )}
        </div>

        <div className="mb-3">
          {showCreateRoom ? (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Search my rooms..."
                  onChange={handleInputChange}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => fetchRooms()}
                  title="Refresh rooms"
                >
                  <Loader2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Enter room name..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                disabled={isCreating}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleCreateRoom} 
                  disabled={isCreating || !newRoomName.trim()} 
                  className="flex-1"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowCreateRoom(false);
                    setNewRoomName("");
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowCreateRoom(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Room
            </Button>
          )}
        </div>

        <Input
          placeholder="Search my rooms..."
          onChange={handleInputChange}
          className="mb-3"
        />
        
        <TabsContent value="rooms" className="flex-1 overflow-hidden">
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground mb-2">
                  {searchTerm ? 'No matching rooms' : 'No rooms joined yet'}
                </p>
                <Button variant="outline" onClick={() => setShowCreateRoom(true)}>
                  Create Your First Room
                </Button>
              </div>
            ) : (
              filteredRooms.map(renderItem)
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="chats" className="flex-1 overflow-hidden">
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {filteredChats.length > 0 ? (
              filteredChats.map(renderItem)
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No chats yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

LeftSidebar.displayName = "LeftSidebar";

export default LeftSidebar;