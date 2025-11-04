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
      setSelectedRoomId(newRoomId); // ✅ FIXED
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
        <Popover open={isMessageSearchOpen} onOpenChange={setIsMessageSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-4">
            <Input
              placeholder="Search messages..."
              value={messageSearchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />

            <div className="max-h-64 overflow-y-auto mt-2 space-y-2">
              {isSearching ? (
                <p>Searching...</p>
              ) : searchResults.length > 0 ? (
                searchResults.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2 rounded-md bg-accent hover:bg-accent/70 cursor-pointer"
                    onClick={() => {
                      setHighlightedMessageId(msg.id);
                      document.getElementById(`msg-${msg.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      setIsMessageSearchOpen(false);
                      setTimeout(() => setHighlightedMessageId(null), 3000);
                    }}
                  >
                    <p className="font-semibold">{msg.profiles?.display_name || msg.profiles?.username}</p>
                    <p>{msg.text}</p>
                  </div>
                ))
              ) : (
                <p>No results.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

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
