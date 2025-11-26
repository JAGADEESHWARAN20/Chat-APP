"use client";

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
import { MoreHorizontal, Navigation } from "lucide-react";
import { useUser } from "@/lib/store/user";

interface MessageProps {
  message: Imessage;
  isNavigated?: boolean;
  searchQuery?: string;
}

export default function Message({ message, isNavigated = false, searchQuery = "" }: MessageProps) {
  const user = useUser((state) => state.user);
  const { highlightedMessageId } = useSearchHighlight();

  if (!message) {
    return <div className="p-2" style={{ color: 'hsl(var(--no-messages-color))', fontSize: 'var(--no-messages-size)' }}>Message not available</div>;
  }

  const isHighlighted = highlightedMessageId === message.id;
  const highlightClass = isHighlighted ? " border-l-[.5vw] border-slate-900 dark:border-white duration-100" : "duration-100";
  const navigationClass = isNavigated ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20" : "";

  // Highlight search terms in message text
  const highlightSearchTerms = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-300 dark:bg-yellow-600 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div 
      id={`msg-${message.id}`} 
      className={`flex gap-2 items-center p-[.3em] ${highlightClass} ${navigationClass} transition-all duration-300`}
    >
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
          
          <div className="flex items-center gap-2">
            {/* Navigation Indicator */}
            {isNavigated && (
              <div className="flex items-center gap-1 text-green-500 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <Navigation className="h-3 w-3" />
                <span className="text-xs font-medium">Live</span>
              </div>
            )}
            
            {message.profiles?.id && user?.id && message.profiles.id === user.id && (
              <MessageMenu message={message} />
            )}
          </div>
        </div>
        <p 
          className="break-words"
          style={{ 
            color: 'hsl(var(--message-text-color))',
            fontSize: 'var(--message-text-size)' 
          }}
        >
          {searchQuery ? highlightSearchTerms(message.text || "Message content not available", searchQuery) : message.text || "Message content not available"}
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
      <DropdownMenuTrigger className="text-gray-400 hover:text-white rounded-full p-1 transition-colors">
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