// components/ChatHeader.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowRightLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";

import ChatPresence from "./ChatPresence";
import { RoomActiveUsers } from "@/components/reusable/RoomActiveUsers";

import {
  useAvailableRooms,
  useRoomActions,
  useSelectedRoom,
} from "@/lib/store/unified-roomstore";

import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------- 
   ChatHeader Component
----------------------------------------------------------------------------- */
export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);

  const selectedRoom = useSelectedRoom();
  const availableRooms = useAvailableRooms();
  const { setSelectedRoomId } = useRoomActions();

  /* --------------------------------------------------------------------------
     CSS VARIABLES STYLES
  -------------------------------------------------------------------------- */
  const headerStyles = {
    // Layout & Spacing
    headerHeight: "var(--header-height, 3.15rem)",
    paddingX: "var(--layout-gap, 1rem)",
    paddingY: "calc(var(--layout-gap, 1rem) * 0.6)",
    gap: "var(--layout-gap, 1rem)",
    borderRadius: "var(--radius-unit, 0.5rem)",

    // Typography
    fontSizeBase: "var(--fs-body, 1rem)",
    fontSizeTitle: "var(--fs-subtitle, 1.25rem)",
    fontSizeSmall: "var(--fs-small, 0.875rem)",
    fontSizeLarge: "var(--fs-title, 1.75rem)",
    fontFamily: 'var(--font-family-base, "Inter", system-ui, sans-serif)',
    fontWeightSemibold: "600",
    lineHeight: "var(--lh-tight, 1.1)",

    // Colors
    backgroundColor: "hsl(var(--background))",
    foregroundColor: "hsl(var(--foreground))",
    mutedForeground: "hsl(var(--muted-foreground))",
    borderColor: "hsl(var(--border))",
    actionActive: "hsl(var(--action-active))",
    actionRing: "hsl(var(--action-ring))",
    roomText: "hsl(var(--room-text))",
    roomTextActive: "hsl(var(--room-text-active))",
    mutedColor: "hsl(var(--muted))",

    // Component Sizes
    iconSize: "var(--spacing-unit, 1rem)",
    buttonSize: "2.5em",
    popoverWidth: "22rem",
    popoverWidthSm: "24rem",
    popoverMaxHeight: "32vh",

    // Effects
    glassOpacity: "var(--glass-opacity, 0.75)",
    glassBlur: "var(--glass-blur, 16px)",
    borderOpacity: "var(--border-opacity, 0.15)",
    shadowStrength: "var(--shadow-strength, 0.12)",

    // Animation
    transitionDuration: "var(--motion-duration, 200ms)",
    transitionEasing: "var(--motion-easing, cubic-bezier(0.2, 0, 0, 1))",

    // Responsive: new semantics (small = full width, large = 50vw)
    widthMobile: "100%",   // full width on small screens
    maxWidthDesktop: "50vw", // cap to 50vw on larger screens

    // Switch specific
    switchCheckedBg: "hsl(240, 70%, 60%)",
    switchUncheckedBg: "hsl(var(--muted))",
  };

  /* ----------------------------------------------------------------------------- 
     Only rooms where user is a member
  ----------------------------------------------------------------------------- */
  const memberRooms = useMemo(
    () => availableRooms.filter((room) => room.is_member === true),
    [availableRooms]
  );

  /* ----------------------------------------------------------------------------- 
     Switch Room Handler
  ----------------------------------------------------------------------------- */
  const handleRoomSwitch = useCallback(
    (newRoomId: string) => {
      setSelectedRoomId(newRoomId);
      setIsSwitchRoomPopoverOpen(false);
    },
    [setSelectedRoomId]
  );

  /* ----------------------------------------------------------------------------- 
     Render
  ----------------------------------------------------------------------------- */
  return (
    <header
      className="flex items-center justify-between"
      style={{
        height: headerStyles.headerHeight,
        // Responsive sizing: fill available width on small screens, cap at 50vw on larger screens
        width: "100%",
        maxWidth: headerStyles.maxWidthDesktop,
        paddingLeft: headerStyles.paddingX,
        paddingRight: headerStyles.paddingX,
        paddingTop: headerStyles.paddingY,
        paddingBottom: headerStyles.paddingY,
        backgroundColor: headerStyles.backgroundColor,
        fontFamily: headerStyles.fontFamily,
        boxSizing: "border-box",
      }}
    >
      {/* Current Room Title */}
      <h1
        className="flex flex-col items-start font-semibold"
        style={{
          fontSize: `clamp(${headerStyles.fontSizeBase}, 4vw, ${headerStyles.fontSizeTitle})`,
          lineHeight: headerStyles.lineHeight,
          fontWeight: headerStyles.fontWeightSemibold,
          color: headerStyles.foregroundColor,
        }}
      >
        {selectedRoom ? `#${selectedRoom.name}` : "General Chat"}
        <ChatPresence />
      </h1>

      {/* Actions */}
      <div className="flex items-center" style={{ gap: headerStyles.gap }}>
        {/* NOTE: RoomAssistant has been removed from header - shown as a bottom-right popover */}
        {/* Room Switcher */}
        <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Switch Room"
              className={cn(
                "relative flex items-center justify-center rounded-full",
                "transition-all ease-in-out active:scale-95",
                "focus-visible:ring-2"
              )}
              style={{
                width: headerStyles.buttonSize,
                height: headerStyles.buttonSize,
                backgroundColor: `${headerStyles.backgroundColor} / ${headerStyles.glassOpacity}`,
                border: `1px solid ${headerStyles.borderColor}`,
                color: headerStyles.foregroundColor,
                transitionDuration: headerStyles.transitionDuration,
                transitionTimingFunction: headerStyles.transitionEasing,
              }}
            >
              <ArrowRightLeft
                className="transition-all"
                style={{
                  width: `calc(${headerStyles.iconSize} * 1.25)`,
                  height: `calc(${headerStyles.iconSize} * 1.25)`,
                  stroke: headerStyles.mutedForeground,
                }}
              />
            </Button>
          </PopoverTrigger>

          {/* Popover List */}
          <PopoverContent
            sideOffset={8}
            align="end"
            className={cn("relative shadow-none z-[50] p-3 rounded-2xl","scrollbar-custom scrollbar-thin", "transition-all duration-300")}
            style={{
              width: `clamp(30vw, ${headerStyles.popoverWidth}, ${headerStyles.popoverWidthSm})`,
              backgroundColor: `${headerStyles.backgroundColor} / 0.75`,
              border: `1px solid ${headerStyles.borderColor}`,
              borderRadius: `calc(${headerStyles.borderRadius} * 2)`,
              fontFamily: headerStyles.fontFamily,
            }}
          >
            <div
              className="flex flex-col overflow-y-auto pr-1"
              style={{
                gap: `calc(${headerStyles.gap} * 0.5)`,
                maxHeight: headerStyles.popoverMaxHeight,
                scrollbarColor: `${headerStyles.mutedForeground} / 0.3 transparent`,
              }}
            >
              {memberRooms.length > 0 ? (
                memberRooms.map((room) => {
                  const isActive = selectedRoom?.id === room.id;

                  return (
                    <motion.div
                      key={room.id}
                      whileHover={{ scale: 1 }}
                      whileTap={{ scale: 1 }}
                      className={cn(
                        "flex justify-between items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        "hover:bg-[hsl(var(--action-active))]/5"
                      )}
                      onClick={() => handleRoomSwitch(room.id)}
                      style={{
                        gap: `calc(${headerStyles.gap} * 0.75)`,
                        padding: headerStyles.gap,
                        borderRadius: `calc(${headerStyles.borderRadius} * 1.5)`,
                        border: `1px solid ${
                          isActive ? `${headerStyles.actionActive} / 0.4` : `${headerStyles.borderColor} / 0.3`
                        }`,
                        backgroundColor: isActive ? `${headerStyles.switchCheckedBg} / 0.1` : `${headerStyles.mutedColor} / 0.3`,
                        transitionDuration: headerStyles.transitionDuration,
                        transitionTimingFunction: headerStyles.transitionEasing,
                      }}
                    >
                      {/* Room Info */}
                      <div className="flex flex-col truncate">
                        <span
                          className={cn("font-bold truncate", isActive ? "text-room-active" : "text-room")}
                          style={{
                            fontSize: headerStyles.fontSizeSmall,
                            fontWeight: headerStyles.fontWeightSemibold,
                          }}
                        >
                          {room.name}
                        </span>

                        <RoomActiveUsers roomId={room.id} />
                      </div>

                      {/* Toggle Switch */}
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleRoomSwitch(room.id)}
                        className={cn(
                          "data-[state=checked]:bg-[hsl(240,70%,60%)]",
                          "data-[state=unchecked]:bg-[hsl(var(--muted))]/40"
                        )}
                      />
                    </motion.div>
                  );
                })
              ) : (
                <p
                  className="text-sm text-center py-3"
                  style={{
                    color: headerStyles.mutedForeground,
                    fontSize: headerStyles.fontSizeSmall,
                    paddingTop: `calc(${headerStyles.gap} * 0.75)`,
                    paddingBottom: `calc(${headerStyles.gap} * 0.75)`,
                  }}
                >
                  No joined rooms found.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
