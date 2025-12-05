"use client";

import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useMemo, useState, useCallback } from "react";
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
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
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

/* ----------------------
   Hook for menu items
   (keeps menu config outside render)
   ---------------------- */
const useMenuItems = () => {
  const setActionMessage = useMessage((state) => state.setActionMessage);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const onEdit = useCallback((message: Imessage) => {
    document.getElementById("trigger-edit")?.click();
    setActionMessage(message, "edit");
  }, [setActionMessage]);

  const onDelete = useCallback((message: Imessage) => {
    document.getElementById("trigger-delete")?.click();
    setActionMessage(message, "delete");
  }, [setActionMessage]);

  const menuItems: MenuItemConfig[] = useMemo(() => [
    {
      type: "edit",
      label: "Edit",
      icon: Edit,
      onClick: onEdit,
    },
    {
      type: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
      destructive: true,
    },
  ], [onEdit, onDelete]);

  return { menuItems, isMobile };
};

/* ----------------------
   Responsive menu item
   ---------------------- */
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
      <span className="flex-1 text-sm font-medium">{item.label}</span>
      <span className="sr-only">{item.label}</span>
    </DropdownMenuItem>
  );
};
ResponsiveMenuItem.displayName = "ResponsiveMenuItem";

/* ----------------------
   MessageMenu component (memoized)
   ---------------------- */
   const MessageMenu: React.FC<{ 
    message: Imessage; 
    menuItems: MenuItemConfig[];
    isMobile: boolean;
  }> = React.memo(({ message, menuItems, isMobile }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="...">
          <MoreHorizontal className="h-5 w-5" />
        </DropdownMenuTrigger>
  
        <DropdownMenuContent className="...">
          <DropdownMenuLabel className="...">
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
  });
  
MessageMenu.displayName = "MessageMenu";

/* ----------------------
   Main Message component (memoized)
   ---------------------- */
function MessageInner({ message, isNavigated = false }: MessageProps) {
  const user = useUser((state) => state.user);
  const { highlightedMessageId } = useSearchHighlight();
  const { menuItems, isMobile } = useMenuItems();  // ← ALWAYS EXECUTED
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

  // Classes
  const highlightClass = isHighlighted 
    ? "bg-slate-700/10 dark:bg-yellow-900/10 border-l-4 border-slate-500" 
    : "bg-transparent";
  const navigationClass = isNavigated 
    ? "bg-green-100/10 dark:bg-green-900/10 border-l-4 border-slate-500 ring-2 ring-green-500/20" 
    : "";
  const backgroundClass = isNavigated ? navigationClass : highlightClass;

  // image error state (avoid DOM manipulation)
  const [imageErrored, setImageErrored] = useState(false);
  const onImageError = useCallback(() => setImageErrored(true), []);

  // memoized initials
  const initial = useMemo(() => {
    return (
      message.profiles?.display_name?.charAt(0)?.toUpperCase()
      || message.profiles?.username?.charAt(0)?.toUpperCase()
      || "?"
    );
  }, [message.profiles?.display_name, message.profiles?.username]);

  // memoized formatted date (cheap)
  const formattedDate = useMemo(() => {
    return message.created_at ? new Date(message.created_at).toDateString() : "Unknown date";
  }, [message.created_at]);

  return (
    <div 
      id={`msg-${message.id}`} 
      className={`flex gap-2 items-center py-1 px-2 rounded-lg transition-all duration-300 ${backgroundClass}`}
      data-message-id={message.id}
    >
      <div className="flex-shrink-0">
        {message.profiles?.avatar_url && !imageErrored ? (
          <Image
            src={message.profiles.avatar_url}
            alt={message.profiles.display_name || message.profiles.username || "User avatar"}
            width={40}
            height={40}
            className="rounded-full ring-2 ring-indigo-500/50"
            // do NOT use `priority` for repeated avatars
            loading="lazy"
            onError={onImageError}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">{initial}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 
              className="font-semibold text-sm sm:text-base"
              style={{ 
                color: 'hsl(var(--message-sender-color))',
                fontSize: 'var(--message-sender-size)' 
              }}
            >
              {message.profiles?.display_name || message.profiles?.username || "Unknown User"}
            </h2>

            <time 
              className="text-xs truncate"
              style={{ 
                color: 'hsl(var(--message-date-color))',
                fontSize: 'var(--message-date-size)' 
              }}
              dateTime={message.created_at ?? undefined}
              title={message.created_at ?? undefined}
            >
              {formattedDate}
            </time>
          </div>
          
          <div className="flex items-center gap-2">
            {message.profiles?.id && user?.id && message.profiles.id === user.id && (
             <MessageMenu 
             message={message} 
             menuItems={menuItems} 
             isMobile={isMobile}
           />
           
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

const MemoizedMessage = React.memo(MessageInner);
MemoizedMessage.displayName = "Message";

export default MemoizedMessage;
