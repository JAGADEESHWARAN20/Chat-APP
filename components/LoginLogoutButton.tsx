"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface LoginLogoutButtonProps {
     user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
     const router = useRouter();
     const supabase = supabaseBrowser();

     const handleLoginWithGithub = () => {
          supabase.auth.signInWithOAuth({
               provider: "github",
               options: {
                    redirectTo: location.origin + "/auth/callback",
               },
          });
     };

     const handleLogout = async () => {
          await supabase.auth.signOut();
          router.refresh();
     };

     return (
          <div className="flex items-center justify-end">
               {user ? (
                    <Button onClick={handleLogout} variant="ghost" size="sm">
                         <LogOut className="h-4 w-4 mr-2" /> Logout
                    </Button>
               ) : (
                    <Button onClick={handleLoginWithGithub} variant="ghost" size="sm">
                         Login
                    </Button>
               )}
          </div>
     );
}