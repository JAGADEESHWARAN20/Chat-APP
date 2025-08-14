"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
// Make sure the ScrollArea component exists at this path or update the path accordingly
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Search, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  is_private?: boolean;
  title?: string;
  memberCount?: number;
  status?: string;
}

interface SearchTabsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roomResults: SearchResult[];
  userResults: SearchResult[];
  onRoomAction: (room: SearchResult) => void;
  onUserAction: (user: SearchResult) => void;
  isLoading?: boolean;
}

export function SearchTabs({
  searchQuery,
  onSearchChange,
  roomResults,
  userResults,
  onRoomAction,
  onUserAction,
  isLoading,
}: SearchTabsProps) {
  return (
    <Tabs defaultValue="rooms" className="w-full">
      <TabsList className="w-full mb-4">
        <TabsTrigger value="rooms" className="flex-1">Rooms</TabsTrigger>
        <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
      </TabsList>
      
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-full"
        />
      </div>

      <TabsContent value="rooms" className="mt-0">
        <ScrollArea className="h-[300px]">
          {roomResults.map((room) => (
            <div
              key={room.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg mb-2",
                "hover:bg-accent cursor-pointer"
              )}
              onClick={() => onRoomAction(room)}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{room.name}</span>
                    {room.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {room.memberCount || 0} members
                  </span>
                </div>
              </div>
              <Button
                variant={room.status === "accepted" ? "secondary" : "default"}
                size="sm"
              >
                {room.status === "accepted" ? "Switch" : "Join"}
              </Button>
            </div>
          ))}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="users" className="mt-0">
        <ScrollArea className="h-[300px]">
          {userResults.map((user) => (
            <div
              key={user.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg mb-2",
                "hover:bg-accent cursor-pointer"
              )}
              onClick={() => onUserAction(user)}
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={user.avatar_url || ""} />
                  <AvatarFallback>
                    {(user.display_name || user.username || "User")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {user.display_name || user.username}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {user.title || "@" + user.username}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
