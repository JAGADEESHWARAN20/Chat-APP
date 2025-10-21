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
import {
  Search,
  ArrowRightLeft,
  LockIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useActiveUsers } from "@/hooks/useActiveUsers";
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
  const { state, switchRoom } = useRoomContext();
  const { selectedRoom, availableRooms } = state;
  const { setHighlightedMessageId, setSearchQuery } = useSearchHighlight();

  // Filter rooms to show only those where user is a member
  const memberRooms = useMemo(() => {
    return availableRooms.filter(room => room.isMember);
  }, [availableRooms]);

  const handleSearch = async (query: string) => {
    setMessageSearchQuery(query);
    setSearchQuery(query);
    if (!selectedRoom?.id) return;

    if (query.trim().length === 0) {
      setSearchResults([]);
      setHighlightedMessageId(null);
      return;
    }

    setIsSearching(true);
    const results = await searchMessages(selectedRoom.id, query);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleRoomSwitch = useCallback(
    async (newRoomId: string) => {
      await switchRoom(newRoomId);
      setIsSwitchRoomPopoverOpen(false);
    },
    [switchRoom]
  );

  return (
    <header className="h-[3.6em] lg:w-[50vw] w-[95vw] flex items-center justify-between px-[1em] py-[1em] glass-gradient-header text-foreground bg-background z-10 dark:text-foreground dark:bg-background">
      <h1 className="text-[2.5vw] lg:text-[1em] flex flex-col font-semibold py-[0.8em] lg:py-[2em] items-start">
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
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={0}
            className="w-[300px] p-4 bg-popover text-popover-foreground backdrop-blur-lg border border-border shadow-xl rounded-xl"
          >
            <div className="p-1">
              <div className="flex justify-between items-center mb-[0.5em]">
                <h3 className="font-bold text-[1.2em]">Search Messages</h3>
              </div>
              <Input
                type="text"
                placeholder="Search messages..."
                value={messageSearchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="mb-2 bg-muted/50 border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />

              <div className="max-h-64 overflow-y-auto space-y-2">
                {isSearching ? (
                  <p className="text-sm text-muted-foreground">Searching...</p>
                ) : searchResults.length > 0 ? (
                  searchResults.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2 rounded-md bg-accent hover:bg-accent/70 cursor-pointer"
                      onClick={() => {
                        setHighlightedMessageId(msg.id);
                        document.getElementById(`msg-${msg.id}`)?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        setIsMessageSearchOpen(false);

                        setTimeout(() => {
                          setHighlightedMessageId(null);
                        }, 3000);
                      }}
                    >
                      <p className="text-sm font-semibold">{msg.profiles?.display_name || msg.profiles?.username}</p>
                      <p className="text-sm text-foreground">{msg.text}</p>
                    </div>
                  ))
                ) : messageSearchQuery ? (
                  <p className="text-sm text-muted-foreground">No results found</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Type to search messages...</p>
                )}
              </div>
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
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={0}
            className="
                !w-[min(32em,95vw)]
                !h-[min(30em,85vh)]
                md:!w-[32em]
                md:!h-[32em]
                mr-[2.3vw]
                lg:mt-[1vw]
                mt-[1em]
                mb-[2vh]
                bg-popover
                text-popover-foreground
                backdrop-blur-xl
                rounded-2xl
                p-[.7em]
                border
                border-border
                !max-w-[95vw]
                !max-h-[99vh]
                shadow-xl
                overflow-hidden
              "
          >
            <div className="p-[.3vw] h-full flex flex-col">
              <h3 className="font-semibold text-[1.1em] mb-4">Switch Room</h3>

              {memberRooms.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[1em] text-muted-foreground text-center">
                    You haven&lsquo;t joined any rooms yet
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden">
                  <ul className="space-y-2 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
                    {memberRooms.map((room) => (
                      <li
                        key={room.id}
                        className="
                            flex items-center justify-between p-3 rounded-lg 
                            bg-transparent hover:bg-accent/50 transition-colors border border-border/30
                          "
                      >
                        <div className="flex items-center gap-3">
                          {/* Room icon */}
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                            <span className="text-lg font-semibold text-indigo-500">
                              {room.name.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Room info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{room.name}</span>
                              {room.is_private && (
                                <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[0.8em] px-2 py-1 text-center text-blue-800 dark:text-white bg-blue-500/20 dark:bg-blue-500/20 border border-blue-500/30 dark:border-blue-500/30 rounded-full">
                                {room.memberCount} members
                              </span>
                              <RoomActiveUsers roomId={room.id} />
                            </div>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <Switch
                          checked={selectedRoom?.id === room.id}
                          onCheckedChange={() => handleRoomSwitch(room.id)}
                          className="
                              data-[state=checked]:bg-indigo-600 
                              data-[state=unchecked]:bg-muted
                            "
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}