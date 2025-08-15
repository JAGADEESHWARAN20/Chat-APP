"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "./ui/button";
import { LogOut, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Link from "next/link";
import { Database } from "@/database.types";

interface LoginLogoutButtonProps {
     user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
     const router = useRouter();
     const supabase = createClientComponentClient<Database>();

     const handleLogout = async () => {
          await supabase.auth.signOut();
          router.refresh();
          router.push('/');
     };

     if (user) {
          return (
               <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                         {user.user_metadata.display_name || user.email}
                    </span>
                    <Button onClick={handleLogout} variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-100/10">
                         <LogOut className="h-4 w-4 mr-2" /> Logout
                    </Button>
               </div>
          );
     }

     return (
          <div className="flex items-center gap-2">
               <Link href="/auth/login">
                    <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-600 hover:bg-blue-100/10">
                         <LogIn className="h-4 w-4 mr-2" /> Sign In
                    </Button>
               </Link>
               <Link href="/auth/register">
                    <Button variant="ghost" size="sm" className="text-green-500 hover:text-green-600 hover:bg-green-100/10">
                         <UserPlus className="h-4 w-4 mr-2" /> Sign Up
                    </Button>
               </Link>
          </div>
     );
}