"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { ArrowRightLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";

import ChatPresence from "./ChatPresence";
import { RoomActiveUsers } from "@/components/reusable/RoomActiveUsers";
import {
  useAvailableRooms,
  useRoomActions,
  useSelectedRoom,
  useUnifiedStore,
} from "@/lib/store/unified-roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useDirectChatActions } from "@/lib/hooks/useDirectChatActions";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);

  const selectedRoom = useSelectedRoom();
  const selectedDirectChat = useDirectChatStore((s) => s.selectedChat);
  const currentUserId = useUnifiedStore((s) => s.userId);

  const availableRooms = useAvailableRooms();
  const { setSelectedRoomId } = useRoomActions();
  const { respondToSelectedChatRequest } = useDirectChatActions();

  const headerWidth = isMobile ? "100vw" : "50vw";

  const memberRooms = useMemo(
    () => availableRooms.filter((room) => room.is_member === true),
    [availableRooms]
  );

  const handleRoomSwitch = useCallback(
    (newRoomId: string) => {
      setSelectedRoomId(newRoomId);
      setIsSwitchRoomPopoverOpen(false);
    },
    [setSelectedRoomId]
  );

  const isDirectPending = selectedDirectChat?.interest_status === "pending";
  const isCurrentUserInitiator = selectedDirectChat?.initiator_id === currentUserId;

  const title = selectedDirectChat
    ? selectedDirectChat.other_user.display_name || selectedDirectChat.other_user.username || "Direct Chat"
    : selectedRoom
    ? `#${selectedRoom.name}`
    : "General Chat";

  return (
    <header
      className="flex items-center justify-between px-[2em]"
      style={{
        width: headerWidth,
        height: "3.8em",
        backgroundColor: "hsl(var(--background))",
        fontFamily: "var(--font-family-base)",
        boxSizing: "border-box",
        transition: "width 200ms ease",
      }}
    >
      <h1 className="flex flex-col items-start font-semibold" style={{ fontSize: "clamp(1rem, 4vw, 1.25rem)", lineHeight: "1.2" }}>
        {title}
        {selectedRoom ? <ChatPresence /> : (
          <span className="text-xs text-muted-foreground">
            {isDirectPending
              ? isCurrentUserInitiator
                ? "Intro sent • waiting for acceptance"
                : "Wants to chat with you"
              : "Direct conversation"}
          </span>
        )}
      </h1>

      <div className="flex items-center gap-2">
        {selectedDirectChat && isDirectPending && !isCurrentUserInitiator && (
          <>
            <Button size="sm" onClick={() => respondToSelectedChatRequest("accept")}>Accept</Button>
            <Button size="sm" variant="outline" onClick={() => respondToSelectedChatRequest("decline")}>Decline</Button>
          </>
        )}

        {!selectedDirectChat && (
          <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Switch Room"
                className="relative flex items-center justify-center rounded-full transition-all active:scale-95"
                style={{
                  width: "3em",
                  height: "3em",
                  marginRight: "1em",
                  backgroundColor: "hsl(var(--background)) / 0.75",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <ArrowRightLeft style={{ width: "1.25em", height: "1.25em", stroke: "hsl(var(--muted-foreground))" }} />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              sideOffset={8}
              align="end"
              className="shadow-none z-[99950] p-3 rounded-2xl scrollbar-custom scrollbar-thin"
              style={{
                width: "clamp(30vw, 22rem, 24rem)",
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
              }}
            >
              <div className="flex flex-col overflow-y-auto pr-1" style={{ maxHeight: "32vh", gap: "0.5rem" }}>
                {memberRooms.length > 0 ? (
                  memberRooms.map((room) => {
                    const isActive = selectedRoom?.id === room.id;

                    return (
                      <motion.div
                        key={room.id}
                        whileTap={{ scale: 1 }}
                        className="flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all hover:bg-[hsl(var(--action-active))]/5"
                        onClick={() => handleRoomSwitch(room.id)}
                        style={{
                          border: `1px solid ${
                            isActive ? "hsl(var(--action-active)) / 0.4" : "hsl(var(--border)) / 0.3"
                          }`,
                          backgroundColor: isActive ? "hsl(240, 70%, 60%) / 0.1" : "hsl(var(--muted)) / 0.3",
                        }}
                      >
                        <div className="flex flex-col truncate">
                          <span
                            className={cn("font-bold truncate", isActive ? "text-room-active" : "text-room")}
                            style={{ fontSize: "0.875rem" }}
                          >
                            {room.name}
                          </span>
                          <RoomActiveUsers roomId={room.id} />
                        </div>

                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleRoomSwitch(room.id)}
                          className="data-[state=checked]:bg-[hsl(240,70%,60%)] data-[state=unchecked]:bg-[hsl(var(--muted))]/40"
                        />
                      </motion.div>
                    );
                  })
                ) : (
                  <p className="text-sm text-center py-3 text-muted-foreground">No joined rooms found.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
}
