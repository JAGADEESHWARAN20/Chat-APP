import { Imessage, useMessage } from "@/lib/store/messages";
import React from "react";
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

export default function Message({ message }: { message: Imessage }) {
  const user = useUser((state) => state.user);

  return (
    <div className="flex gap-2 p-3 rounded-lg hover:bg-gray-800/50 transition-colors">
      <div className="flex-shrink-0">
        <Image
          src={message.users?.avatar_url!}
          alt={message.users?.display_name!}
          width={40}
          height={40}
          className="rounded-full ring-2 ring-gray-500/50"
        />
      </div>
      <div className="flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
           <h1 className="font-semibold text-foreground text-sm sm:text-base">
              {message.users?.display_name}
            </h1>

            <h1 className="text-xs text-muted-foreground truncate">
              {new Date(message.created_at).toDateString()}
            </h1>

            
          </div>
          {message.users?.id === user?.id && (
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

  const handleEdit = () => {
    setActionMessage(message);
    // Trigger the edit dialog
    setTimeout(() => {
      document.getElementById("trigger-edit")?.click();
    }, 100);
  };

  const handleDelete = () => {
    setActionMessage(message);
    // Trigger the delete dialog
    setTimeout(() => {
      document.getElementById("trigger-delete")?.click();
    }, 100);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full p-1 transition-colors">
        <MoreHorizontal className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        sideOffset={8}
        className="bg-gray-800 border-gray-700/50 text-white rounded-lg shadow-lg"
      >
        <DropdownMenuLabel className="text-gray-300">Message Actions</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-700/50" />
        <DropdownMenuItem
          onClick={handleEdit}
          className="text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white rounded-md transition-colors"
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-gray-200 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white rounded-md transition-colors"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};