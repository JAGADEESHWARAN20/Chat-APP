"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { User as SupabaseUser } from "@supabase/supabase-js";
import ChatPresence from "./ChatPresence";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, ArrowRightLeft, LockIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSelectedRoom, useAvailableRooms, useRoomActions } from "@/lib/store/RoomContext";
import { useMessage, Imessage } from "@/lib/store/messages";
import { useSearchHighlight } from "@/lib/store/SearchHighlightContext";
import { RoomActiveUsers } from "@/components/reusable/RoomActiveUsers";
import { RoomAssistantDialog } from "./AIchatDialog";
import { cn } from "@/lib/utils";

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const { searchMessages } = useMessage();
  const [searchResults, setSearchResults] = useState<Imessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");

  const selectedRoom = useSelectedRoom();
  const availableRooms = useAvailableRooms();
  const { setSelectedRoomId } = useRoomActions();

  const { setHighlightedMessageId, setSearchQuery } = useSearchHighlight();

  const memberRooms = useMemo(() => {
    return availableRooms.filter(room => room.isMember);
  }, [availableRooms]);

  const handleSearch = useCallback(async (query: string) => {
    setMessageSearchQuery(query);
    setSearchQuery(query);
    if (!selectedRoom?.id) return;

    if (query.trim().length === 0) {
      setSearchResults([]);
      setHighlightedMessageId(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchMessages(selectedRoom.id, query);
      setSearchResults(results);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedRoom?.id, searchMessages, setSearchQuery, setHighlightedMessageId]);

  const handleRoomSwitch = useCallback(
    (newRoomId: string) => {
      setSelectedRoomId(newRoomId); // ✅ now correctly updates Zustand
      setIsSwitchRoomPopoverOpen(false);
    },
    [setSelectedRoomId]
  );
  return (
    <header className="h-[3.6em] lg:w-[50vw] w-[95vw] flex items-center justify-between px-[1em] py-[1em]">
      <h1 className="text-[2.5vw] lg:text-[1em] flex flex-col font-semibold items-start">
        {selectedRoom ? `#${selectedRoom.name}` : "General Chat"}
        <ChatPresence />
      </h1>

      <div className="flex items-center space-x-[1.2vw]">

       {/* Message Search */}
<div className="relative">
  {/* Background blur overlay */}
  {isMessageSearchOpen && (
    <div
      className="
        fixed inset-0 z-[40] backdrop-blur-[6px] 
        bg-[hsl(var(--background))]/30 
        transition-all duration-300 ease-in-out
      "
      onClick={() => setIsMessageSearchOpen(false)}
    />
  )}

  <Popover open={isMessageSearchOpen} onOpenChange={setIsMessageSearchOpen}>
  <PopoverTrigger asChild>
  <Button
    onClick={() => setIsMessageSearchOpen(!isMessageSearchOpen)}
    variant="ghost"
    size="icon"
    className={cn(
      "relative w-[2.5em] h-[2.5em] flex items-center justify-center",
      "rounded-full border border-[hsl(var(--border))/40]",
      "bg-[hsl(var(--background))]/60 backdrop-blur-md shadow-sm",
      "transition-all duration-300 ease-in-out group",
      "hover:bg-[hsl(var(--action-active))]/15 hover:scale-[1.05]",
      "active:scale-95",
      "focus-visible:ring-[hsl(var(--action-ring))]/50 focus-visible:ring-2",
      "text-[hsl(var(--foreground))]"
    )}
    title="Search Messages"
  >
    <Search
      className={cn(
        "h-5 w-5 transition-all duration-300",
        isMessageSearchOpen
          ? "stroke-[hsl(var(--action-active))]"
          : "stroke-[hsl(var(--muted-foreground))] group-hover:stroke-[hsl(var(--foreground))]"
      )}
    />
  </Button>
</PopoverTrigger>


    <PopoverContent
      sideOffset={8}
      align="end"
      className={`
        relative z-[50] w-[22rem] sm:w-[24rem] p-4 pt-1 pl-1 pr-1 rounded-2xl
        border border-[hsl(var(--border))/40]
        bg-[hsl(var(--background))]/75 
        backdrop-blur-2xl
        shadow-none 
        transition-all duration-300
        animate-in fade-in slide-in-from-top-2
      `}
    >
      <Input
        placeholder="Search messages..."
        value={messageSearchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="
          w-full px-3 py-2 text-sm rounded-xl
          bg-[hsl(var(--muted))]/40
          text-[hsl(var(--foreground))] 
          border border-[hsl(var(--border))/20]
          placeholder:text-[hsl(var(--muted-foreground))]/70
          focus-visible:ring-[hsl(var(--action-ring))]/60
          focus-visible:ring-2
          transition-all duration-200
        "
      />

      <div
        className="
          max-h-64 mt-3 overflow-y-auto 
          space-y-2 pr-3 pl-2 scrollbar-thin 
          scrollbar-thumb-[hsl(var(--muted-foreground))]/30
          scrollbar-track-transparent
        "
      >
        {isSearching ? (
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Searching...</p>
        ) : searchResults.length > 0 ? (
          searchResults.map((msg) => (
            <div
              key={msg.id}
              className="
                p-3 rounded-lg cursor-pointer
                bg-[hsl(var(--muted))]/30 
                hover:bg-[hsl(var(--action-active))]/15 
                text-[hsl(var(--foreground))]
                border border-black/20 dark:border-white/20
                transition-all duration-200
              "
              onClick={() => {
                setHighlightedMessageId(msg.id);
                document
                  .getElementById(`msg-${msg.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                setIsMessageSearchOpen(false);
                setTimeout(() => setHighlightedMessageId(null), 3000);
              }}
            >
              <p className="font-semibold text-sm">
                {msg.profiles?.display_name || msg.profiles?.username}
              </p>
              <p className="text-[hsl(var(--muted-foreground))] text-xs line-clamp-2">
                {msg.text}
              </p>
            </div>
          ))
        ) : (
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No results found.</p>
        )}
      </div>
    </PopoverContent>
  </Popover>
</div>


        {selectedRoom && (
  <RoomAssistantDialog 
    roomId={selectedRoom.id} 
    roomName={selectedRoom.name}
  />
)}


        {/* Switch Room */}
        <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <ArrowRightLeft className="h-5 w-5" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[22rem] p-3 max-h-[300px] overflow-y-auto">
            {memberRooms.map((room) => (
              <div key={room.id} className="flex justify-between items-center py-2 px-2">
                <div className="flex flex-col">
                  <span className="font-semibold">{room.name}</span>
                  <RoomActiveUsers roomId={room.id} />
                </div>
                <Switch
                  checked={selectedRoom?.id === room.id}
                  onCheckedChange={() => handleRoomSwitch(room.id)}
                />
              </div>
            ))}
          </PopoverContent>
        </Popover>

      </div>
    </header>
  );
}
