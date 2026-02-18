"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { type UserData } from "@/lib/store/unified-roomstore";
import { cn } from "@/lib/utils";

interface UserCardProps {
  user: UserData;
  query: string;
  onMessage?: (user: UserData) => void;
}

export default memo(function UserCard({ user, onMessage }: UserCardProps) {
  const name = user.display_name || user.username || "Unknown";

  return (
    <article
      className={cn(
        "relative w-full rounded-2xl border border-border/40 bg-card transition-all",
        "hover:shadow-md hover:border-border/60",
        "w-[85vw] h-[30em] md:w-auto md:h-[20vw] flex flex-col overflow-hidden"
      )}
    >
      <div className="p-4 flex items-center gap-4">
        <Avatar className="h-14 w-14 rounded-xl flex-shrink-0">
          <AvatarImage src={user.avatar_url || ""} alt={name} />
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
            {(user.username || "U")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        </div>
      </div>

      <div className="px-4 flex-1 flex items-start">
        {user.bio ? (
          <p className="text-sm text-muted-foreground leading-snug line-clamp-4">{user.bio}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">No bio added...</p>
        )}
      </div>

      <div className="p-4 mt-auto grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-lg h-10"
          asChild
        >
          <a href={`/profile/${user.id}`}>View Profile</a>
        </Button>
        <Button
          size="sm"
          className="w-full rounded-lg h-10"
          onClick={() => onMessage?.(user)}
        >
          Message
        </Button>
      </div>
    </article>
  );
});
