"use client";

import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useState } from "react";
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useUser } from "@/lib/store/user";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Message({ message }: { message: Imessage }) {
  const user = useUser((state) => state.user);
  const [avatar, setAvatar] = useState(message.profiles?.avatar_url);
  const [displayName, setDisplayName] = useState(
    message.profiles?.display_name
  );

  // 🔴 Subscribe to profile updates (live avatar refresh)
  useEffect(() => {
    if (!message.profiles?.id) return;

    const channel = supabaseBrowser
      .channel(`profile-changes-${message.profiles.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${message.profiles.id}`,
        },
        (payload) => {
          if (payload.new) {
            setAvatar(payload.new.avatar_url);
            setDisplayName(payload.new.display_name);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [message.profiles?.id]);

  return (
    <div className="flex gap-2 p-[.5em] rounded-lg">
      <div className="flex-shrink-0">
        <Image
          src={avatar || "/default-avatar.png"}
          alt={displayName || "User"}
          width={40}
          height={40}
          className="rounded-full ring-2 ring-indigo-500/50"
          priority
        />
      </div>
      <div className="flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-foreground text-sm sm:text-base">
              {displayName}
            </h1>

            <h1 className="text-xs text-muted-foreground truncate">
              {new Date(message.created_at).toDateString()}
            </h1>
          </div>
          {message.profiles?.id === user?.id && (
            <MessageMenu message={message} />
          )}
        </div>
        <p className="dark:text-gray-200 text-black text-[1.22em] break-words">
          {message.text}
        </p>
      </div>
    </div>
  );
}

const MessageMenu = ({ message }: { message: Imessage }) => {
  const setActionMessage = useMessage((state) => state.setActionMessage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1 transition-colors">
        <MoreHorizontal className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="bg-gray-800 border-gray-700/50 text-white rounded-lg shadow-lg"
      >
        <DropdownMenuLabel className="text-gray-300">Action</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-700/50" />
        <DropdownMenuItem
          onClick={() => {
            document.getElementById("trigger-edit")?.click();
            setActionMessage(message);
          }}
          className="text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white rounded-md transition-colors"
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            document.getElementById("trigger-delete")?.click();
            setActionMessage(message);
          }}
          className="text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white rounded-md transition-colors"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
