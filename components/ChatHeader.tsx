// components/ChatHeader.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { User as SupabaseUser } from "@supabase/supabase-js";
import ChatPresence from "./ChatPresence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMessage, Imessage } from "@/lib/store/messages";
import { useSearchHighlight } from "@/lib/store/SearchHighlightContext";
import { RoomActiveUsers } from "@/components/reusable/RoomActiveUsers";
import { RoomAssistantDialog } from "./AIchatDialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAvailableRooms, useRoomActions, useSelectedRoom } from "@/lib/store/roomstore";

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

  const memberRooms = useMemo(() => availableRooms.filter((room) => room.isMember), [availableRooms]);

  const handleSearch = useCallback(
    async (query: string) => {
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
    },
    [selectedRoom?.id, searchMessages, setSearchQuery, setHighlightedMessageId]
  );

  const handleRoomSwitch = useCallback(
    (newRoomId: string) => {
      setSelectedRoomId(newRoomId);
      setIsSwitchRoomPopoverOpen(false);
    },
    [setSelectedRoomId]
  );

  return (
    <header className="h-[3.6em] lg:w-[50vw] w-[95vw] flex items-center justify-between px-[1em] py-[0.6em]">
      <h1 className="text-[2.5vw] lg:text-[1em] flex flex-col font-semibold items-start">
        {selectedRoom ? `#${selectedRoom.name}` : "General Chat"}
        <ChatPresence />
      </h1>

      <div className="flex items-center space-x-[1.2vw]">
        {/* Message Search */}
        <div className="relative ">
          {isMessageSearchOpen && (
            <div
              className="fixed inset-0 z-[40]   bg-[hsl(var(--background))]/30 transition-all duration-300 ease-in-out"
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
                  "relative w-[2.5em] h-[2.5em] flex items-center justify-center rounded-full",
                  "bg-[hsl(var(--background))]/60 backdrop-blur-md shadow-sm",
                  "transition-all duration-300 ease-in-out group hover:bg-[hsl(var(--action-active))]/15 active:scale-95",
                  "focus-visible:ring-[hsl(var(--action-ring))]/50 focus-visible:ring-2",
                  "text-[hsl(var(--foreground))]"
                )}
                title="Search Messages"
              >
                <Search className="h-5 w-5 transition-all duration-300 stroke-[hsl(var(--muted-foreground))]" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
            side="bottom"
              sideOffset={8}
              align="end"
              className={`
                relative z-[50] w-[24rem] p-4 mr-[-2em]  rounded-2xl
                border border-[hsl(var(--border))/40]
                bg-[hsl(var(--background))]/75 
                backdrop-blur-2xl
                shadow-none 
                transition-all duration-300
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

              <div className="max-h-64 mt-3 overflow-y-auto space-y-2 pr-3 pl-2 scrollbar-thin scrollbar-thumb-[hsl(var(--muted-foreground))]/30">
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
                        border border-[hsl(var(--border))/20]
                        transition-all duration-200
                      "
                      onClick={() => {
                        setHighlightedMessageId(msg.id);
                        document.getElementById(`msg-${msg.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                        setIsMessageSearchOpen(false);
                        setTimeout(() => setHighlightedMessageId(null), 3000);
                      }}
                    >
                      <p className="font-semibold text-sm">{msg.profiles?.display_name || msg.profiles?.username}</p>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs line-clamp-2">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[hsl(var(--muted-foreground))] text-sm">No results found.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {selectedRoom && <RoomAssistantDialog roomId={selectedRoom.id} roomName={selectedRoom.name} />}

        {/* Switch Room */}
        <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative w-[2.5em] h-[2.5em] flex items-center justify-center rounded-full",
                "bg-[hsl(var(--background))]/60 backdrop-blur-md shadow-sm",
                "transition-all duration-300 ease-in-out group hover:bg-[hsl(var(--action-active))]/15 active:scale-95",
                "focus-visible:ring-[hsl(var(--action-ring))]/50 focus-visible:ring-2",
                "text-[hsl(var(--foreground))]"
              )}
              title="Switch Room"
            >
              <ArrowRightLeft className="h-5 w-5 transition-all duration-300 stroke-[hsl(var(--muted-foreground))]" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            sideOffset={8}
            align="end"
            className={cn(
              "relative z-[50] w-[22rem] sm:w-[24rem] p-3 rounded-2xl",
              "border border-[hsl(var(--border))/40]",
              "bg-[hsl(var(--background))]/75 backdrop-blur-2xl",
              "shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
              "transition-all duration-300"
            )}
          >
            <div className="flex flex-col gap-2 max-h-[32vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[hsl(var(--muted-foreground))]/30 pr-1">
              {memberRooms.length > 0 ? (
                memberRooms.map((room) => {
                  const isActive = selectedRoom?.id === room.id;
                  return (
                    <motion.div
                      key={room.id}
                      whileHover={{ scale: 1 }}
                      whileTap={{ scale: 1 }}
                      className={cn(
                        "flex justify-between items-center gap-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer",
                        isActive
                          ? "bg-[hsl(240,70%,60%)]/10 border-[hsl(var(--action-active))]/40"
                          : "bg-[hsl(var(--muted))]/30 border-[hsl(var(--border))/30] hover:bg-[hsl(var(--action-active))]/5"
                      )}
                      onClick={() => handleRoomSwitch(room.id)}
                    >
                      <div className="flex flex-col truncate">
                      <span
                          className={cn(
                            "font-bold text-sm truncate",
                            isActive ? "text-room-active" : "text-room",
                          )}
                        >
                          {room.name}
                        </span>

                        <RoomActiveUsers roomId={room.id} />
                      </div>

                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleRoomSwitch(room.id)}
                        className={cn("data-[state=checked]:bg-[hsl(240,70%,60%)] data-[state=unchecked]:bg-[hsl(var(--muted))]/40")}
                      />
                    </motion.div>
                  );
                })
              ) : (
                <p className="text-[hsl(var(--muted-foreground))] text-sm text-center py-3">No joined rooms found.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
