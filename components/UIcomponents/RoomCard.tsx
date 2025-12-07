// components/RoomCard.tsx
"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Users, Lock, MessageCircle } from "lucide-react";
import { type RoomData } from "@/lib/store/unified-roomstore";
import { cn } from "@/lib/utils";


export default memo(function RoomCard({
  room,
  query,
  onJoin,
  onLeave,
  onOpen,
}: {
  room: RoomData;
  query: string;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const isMember = room.is_member && room.participation_status === "accepted";
  const pending = room.participation_status === "pending";

  return (
    <article
      className={cn(
        // core: full width in single-col grid; limited width in multi-col via grid itself
        "w-full rounded-xl border border-border/40 bg-card overflow-hidden transition",
        "hover:border-black/20"
      )}
      role="group"
      aria-label={`room-${room.name}`}
    >
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[1.2em] font-semibold truncate">
            <span className="text-muted-foreground">#</span>
            <span className="truncate ">{room.name}</span>
            {room.is_private && <Lock className="ml-2 h-4 w-4 opacity-60" />}
          </div>
          <div className="mt-[.4em] text-[1.3em]  text-muted-foreground flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Users className=" opacity-60" />
              <span>{room.member_count}</span>
            </span>

            {room.online_users > 0 && (
              <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                {room.online_users} online
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-xs">
          {room.unread_count > 0 && (
            <span className="flex items-center justify-center text-center bg-red-600 text-white text-[1.5em] w-[2em] h-[2em] rounded-full ">
              {room.unread_count > 99 ? "99+" : room.unread_count}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border/30 flex flex-col gap-3">
        <p className="text-[1.5em] gap-[.5em] text-muted-foreground truncate flex items-center ">
        <MessageCircle/> {room.latest_message ? ` ${room.latest_message}` : "No messages yet ---"}
        </p>

        <div className="flex gap-2">
          {isMember ? (
            <>
              <Button size="sm" className="flex-1 h-9" onClick={() => onOpen(room.id)}>
                Open
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-red-600 border border-border/20"
                onClick={() => onLeave(room.id)}
              >
                Leave
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1 h-9" onClick={() => onJoin(room.id)} disabled={pending}>
              {pending ? "Request Sent" : "Join"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});
