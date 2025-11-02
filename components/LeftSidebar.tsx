"use client";
import React, { useState, useMemo, useCallback, memo } from "react";
import { RoomWithMembershipCount, useRoomContext } from "@/lib/store/RoomContext";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ChevronRight, MessageSquare, Users, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "./ui/button";
import { RoomActiveUsers } from "@/components/reusable/RoomActiveUsers";

const LeftSidebar = memo(function LeftSidebar({
  user,
  isOpen,
  onClose,
}: {
  user: any;
  isOpen: boolean;
  onClose?: () => void;
}) {
  const { state, setSelectedRoom, createRoom } = useRoomContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [directChats] = useState<RoomWithMembershipCount[]>([]);

  // ✅ Filter to show ONLY joined rooms (status = "accepted")
  const joinedRooms = useMemo(() => {
    return (state.availableRooms || []).filter(room => room.isMember === true);
  }, [state.availableRooms]);

  const filteredRooms = useMemo(() => 
    joinedRooms.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [joinedRooms, searchTerm]
  );

  const filteredChats = useMemo(() => 
    directChats.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [directChats, searchTerm]
  );

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    
    setIsCreating(true);
    try {
      await createRoom(newRoomName, false);
      setNewRoomName("");
      setShowCreateRoom(false);
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // ✅ FIXED: Render item with proper member count display
  const renderItem = useCallback((item: RoomWithMembershipCount) => {
    // Ensure we have valid member count
    const memberCount = item.memberCount ?? 0;
    const onlineCount = item.onlineUsers ?? 0;
    
    console.log(`[LeftSidebar] Rendering: ${item.name}`, {
      memberCount,
      onlineCount,
      isMember: item.isMember,
      status: item.participationStatus
    });
    
    return (
      <div
        key={item.id}
        className={`flex items-start p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
          state.selectedRoom?.id === item.id
            ? "bg-primary/10 dark:bg-primary/20"
            : "hover:bg-muted dark:hover:bg-muted/50"
        }`}
        onClick={() => setSelectedRoom(item)}
      >
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage 
            src={`/avatars/${item.id}.png`} 
            alt={item.name} 
          />
        </Avatar>
        
        <div className="ml-3 flex-1 min-w-0">
          {/* Room name and notification count */}
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-foreground truncate">
              #{item.name}
            </div>
            {(item.unreadCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-1 min-w-5 h-5 flex items-center justify-center">
                  {(item.unreadCount ?? 0) > 99 ? '99+' : item.unreadCount}
                </span>
              </div>
            )}
          </div>

          {/* Latest message */}
          <div className="text-sm text-muted-foreground truncate mb-2">
            {item.latestMessage || "No messages yet"}
          </div>

          {/* ✅ FIXED: User count display with actual numbers */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Total Members */}
              <div className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full">
                <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>
              
              {/* Active/Online Users */}
              {onlineCount > 0 && (
                <div className="flex items-center gap-1 text-xs px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {onlineCount} online
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom row: Status badge and date */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1">
              Joined
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(item.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    );
  }, [state.selectedRoom?.id, setSelectedRoom]);

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 w-full lg:w-1/4 px-4 py-3 bg-card border-r border-border/40 h-screen flex flex-col transition-transform duration-300 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } z-50 lg:z-0`}
    >
      <Tabs defaultValue="rooms" className="w-full mt-0 lg:mt-0 flex flex-col gap-[.1em]">
        <div className="flex gap-[.2em] items-center">
          <TabsList className="grid w-full grid-cols-2 mb-1">
            <TabsTrigger value="rooms">My Rooms</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>
          {onClose && (
            <Button
              onClick={onClose}
              className="p-2 rounded-full bg-background/80 hover:bg-muted transition-colors lg:hidden"
              aria-label="Close sidebar"
            >
              <ChevronRight className="h-5 w-5 text-foreground rotate-180 duration-200 transition-all" />
            </Button>
          )}
        </div>

        {/* Create Room Section */}
        <div className="mb-3">
          {showCreateRoom ? (
            <div className="space-y-2 p-3 border border-border rounded-lg bg-background/50">
              <input
                type="text"
                placeholder="Enter room name..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full p-2 border border-input rounded text-sm bg-background text-foreground placeholder-muted-foreground"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateRoom}
                  disabled={isCreating || !newRoomName.trim()}
                  className="flex-1"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateRoom(false);
                    setNewRoomName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={() => setShowCreateRoom(true)}
            >
              <Plus className="h-4 w-4" />
              Create New Room
            </Button>
          )}
        </div>

        <input
          type="text"
          placeholder="Search my rooms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-1 border border-input rounded-lg focus:ring-2 focus:ring-primary outline-none bg-background text-foreground placeholder-muted-foreground"
        />
        
        <TabsContent value="rooms">
          <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
            {state.isLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <div className="text-muted-foreground mb-2">
                  {searchTerm ? 'No matching rooms found' : 'No rooms joined yet'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {searchTerm ? 'Try a different search term' : 'Join or create a room to get started'}
                </div>
              </div>
            ) : (
              filteredRooms.map(renderItem)
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="chats">
          <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
            {filteredChats.length > 0 ? (
              filteredChats.map(renderItem)
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <div className="text-muted-foreground">
                  No direct chats yet
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Start a conversation with someone
                </div>
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