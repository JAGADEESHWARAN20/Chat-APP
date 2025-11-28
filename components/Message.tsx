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
import { MoreHorizontal, Navigation, Edit, Trash2, FileEdit, MessageCircle } from "lucide-react";
import { useUser } from "@/lib/store/user";
import { useMediaQuery } from "@/hooks/use-media-query";

interface MessageProps {
  message: Imessage;
  isNavigated?: boolean;
  searchQuery?: string;
}

// Types for menu configuration
type MenuActionType = "edit" | "delete" | "reply" | "copy";

interface MenuItemConfig {
  type: MenuActionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: (message: Imessage) => void;
  destructive?: boolean;
}

// Hook for responsive menu items
const useMenuItems = () => {
  const setActionMessage = useMessage((state) => state.setActionMessage);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const menuItems: MenuItemConfig[] = [
    {
      type: "edit",
      label: "Edit",
      icon: Edit,
      onClick: (message: Imessage) => {
        document.getElementById("trigger-edit")?.click();
        setActionMessage(message, "edit");
      }
    },
    {
      type: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: (message: Imessage) => {
        document.getElementById("trigger-delete")?.click();
        setActionMessage(message, "delete");
      },
      destructive: true
    },
   
  ];

  return { menuItems, isMobile };
};

// Responsive menu item component
const ResponsiveMenuItem: React.FC<{
  item: MenuItemConfig;
  message: Imessage;
  isMobile: boolean;
}> = ({ item, message, isMobile }) => {
  const Icon = item.icon;
  
  return (
    <DropdownMenuItem
      onClick={() => item.onClick(message)}
      className={`
        flex items-center gap-3 rounded-md py-3 px-4 transition-all duration-200
        ${item.destructive 
          ? "text-red-200 hover:bg-red-600 hover:text-white focus:bg-red-600 focus:text-white" 
          : "text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white"
        }
      `}
    >
      <Icon className={`flex-shrink-0 ${isMobile ? "h-4 w-4" : "h-4 w-4"}`} />
      
    
        <span className="flex-1 text-sm font-medium">
          {item.label}
        </span>
    
      
    
        <span className="sr-only">{item.label}</span>
    
    </DropdownMenuItem>
  );
};

// Main Message component
export default function Message({ message, isNavigated = false, searchQuery = "" }: MessageProps) {
  const user = useUser((state) => state.user);
  const { highlightedMessageId } = useSearchHighlight();

  if (!message) {
    return (
      <div 
        className="p-2" 
        style={{ 
          color: 'hsl(var(--no-messages-color))', 
          fontSize: 'var(--no-messages-size)' 
        }}
      >
        Message not available
      </div>
    );
  }

  const isHighlighted = highlightedMessageId === message.id;
  
  // Background highlight classes
  const highlightClass = isHighlighted 
    ? "bg-slate-700/10 dark:bg-yellow-900/10 border-l-4 border-slate-500" 
    : "bg-transparent";
  
  const navigationClass = isNavigated 
    ? "bg-green-100/10 dark:bg-green-900/10 border-l-4 border-slate-500 ring-2 ring-green-500/20" 
    : "";

  // Combine classes - navigation takes priority over regular highlight
  const backgroundClass = isNavigated ? navigationClass : highlightClass;

  return (
    <div 
      id={`msg-${message.id}`} 
      className={`flex gap-2 items-center py-1 px-2 rounded-lg transition-all duration-300 ${backgroundClass}`}
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
        <div className={`w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center ${message.profiles?.avatar_url ? 'hidden' : ''}`}>
          <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
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
            
            
            {message.profiles?.id && user?.id && message.profiles.id === user.id && (
              <MessageMenu message={message} />
            )}
          </div>
        </div>
        <p 
          className="break-words mt-1"
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

// Enhanced MessageMenu component
const MessageMenu: React.FC<{ message: Imessage }> = ({ message }) => {
  const { menuItems, isMobile } = useMenuItems();

  if (!message) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className="
          text-gray-400 hover:text-slate-700 dark:text-slate-500 
          dark:hover:text-slate-300 rounded-full p-1 
          transition-all duration-200 hover:bg-slate-200 
          dark:hover:bg-slate-700 focus:outline-none 
          focus:ring-2 focus:ring-slate-400 focus:ring-opacity-50
        "
        aria-label="Message actions"
      >
        <MoreHorizontal className="h-5 w-5" />
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={`
          bg-gray-800 border-gray-700/50 text-white rounded-xl 
          shadow-2xl backdrop-blur-sm min-w-[180px]
          ${isMobile ? 'w-16 py-2' : 'w-48 py-3'}
        `}
      >
        <DropdownMenuLabel className="text-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
          {isMobile ? "Actions" : "Message Actions"}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-gray-700/50 mx-2" />
        
        <div className="space-y-1">
          {menuItems.map((item) => (
            <ResponsiveMenuItem
              key={item.type}
              item={item}
              message={message}
              isMobile={isMobile}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};