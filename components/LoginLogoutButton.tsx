"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Database } from "@/database.types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LoginLogoutButtonProps {
  user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  if (user) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Avatar className="cursor-pointer">
            <AvatarImage
              src={user.user_metadata.avatar_url || ""}
              alt={user.user_metadata.display_name || user.email}
            />
            <AvatarFallback>
              {user.email?.[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent className="w-48">
          <div className="flex flex-col gap-2">
            <Link href={`/profile/${user.id}`}>
              <Button variant="outline" size="sm" className="w-full">
                View Profile
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-100/10"
            >
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/auth/login">
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-500 hover:text-blue-600 hover:bg-blue-100/10"
        >
          Sign In
        </Button>
      </Link>
      <Link href="/auth/register">
        <Button
          variant="ghost"
          size="sm"
          className="text-green-500 hover:text-green-600 hover:bg-green-100/10"
        >
          Sign Up
        </Button>
      </Link>
    </div>
  );
}
