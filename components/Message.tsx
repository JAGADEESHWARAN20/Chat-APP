import { Imessage, useMessage } from "@/lib/store/messages";
import React from "react";
import Image from "next/image";
import { useSearchHighlight } from "@/lib/store/SearchHighlightContext";

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

export default function Message({ message }: { message: Imessage }) {
  const user = useUser((state) => state.user);
  const { highlightedMessageId } = useSearchHighlight();

  if (!message) {
    return <div className="p-2" style={{ color: 'hsl(var(--no-messages-color))', fontSize: 'var(--no-messages-size)' }}>Message not available</div>;
  }

  const isHighlighted = highlightedMessageId === message.id;
  const highlightClass = isHighlighted ? "bg-slate-300 dark:bg-slate-300/40 border-l-[.5vw] border-slate-900 dark:border-white duration-100" : "duration-100";

  return (
    <div id={`msg-${message.id}`} className={`flex gap-2 items-center p-[.3em] ${highlightClass}`}>
      <div className="flex-shrink-0">
        {message.profiles?.avatar_url ? (
          <Image
            src={message.profiles.avatar_url}
            alt={message.profiles.display_name || message.profiles.username || "User avatar"}
            width={40}
            height={40}
            className="rounded-full ring-2 ring-indigo-500/50"
            priority
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-10 h-10 rounded-full ring-2 ring-indigo-500/50 bg-gray-300 flex items-center justify-center ${message.profiles?.avatar_url ? 'hidden' : ''}`}>
          <span className="text-gray-600 text-sm font-medium">
            {message.profiles?.display_name?.charAt(0)?.toUpperCase() ||
              message.profiles?.username?.charAt(0)?.toUpperCase() ||
              "?"}
          </span>
        </div>
      </div>
      <div className="flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 
              className="font-semibold text-sm sm:text-base"
              style={{ 
                color: 'hsl(var(--message-sender-color))',
                fontSize: 'var(--message-sender-size)' 
              }}
            >
              {message.profiles?.display_name || message.profiles?.username || "Unknown User"}
            </h1>

            <h1 
              className="text-xs truncate"
              style={{ 
                color: 'hsl(var(--message-date-color))',
                fontSize: 'var(--message-date-size)' 
              }}
            >
              {message.created_at ? new Date(message.created_at).toDateString() : "Unknown date"}
            </h1>
          </div>
          {message.profiles?.id && user?.id && message.profiles.id === user.id && (
            <MessageMenu message={message} />
          )}
        </div>
        <p 
          className="break-words"
          style={{ 
            color: 'hsl(var(--message-text-color))',
            fontSize: 'var(--message-text-size)' 
          }}
        >
          {message.text || "Message content not available"}
        </p>
      </div>
    </div>
  );
}

const MessageMenu = ({ message }: { message: Imessage }) => {
  const setActionMessage = useMessage((state) => state.setActionMessage);

  // Add safety check for message
  if (!message) {
    return null;
  }

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
            setActionMessage(message, "edit");
          }}
          className="text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white rounded-md transition-colors"
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            document.getElementById("trigger-delete")?.click();
            setActionMessage(message, "delete");
          }}
          className="text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white rounded-md transition-colors"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};