"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Profile type from Supabase
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function ProfilePage() {
  // FIX: Use useState with a function to create the client once and keep it stable
  const [supabase] = useState(() => 
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, bio, created_at, updated_at, avatar_url, last_login"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      setProfile(data);
    };

    getProfile();
  }, [supabase]); // FIX: Added supabase to dependency array

  // ---------- LOADING ----------
  if (!profile)
    return (
      <div className="mx-auto mt-8 p-8 bg-card text-card-foreground shadow-xl rounded-2xl border border-border">
        <Skeleton className="h-6 w-24 mb-6" />
        <hr className="mb-6 border-border" />

        <div className="flex items-center gap-6 mb-8">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-16 w-full mb-8" />

        <Skeleton className="h-4 w-40 mb-8" />
        <Skeleton className="h-10 w-full" />
      </div>
    );

  // ---------- DISPLAY PROFILE ----------
  return (
    <div className="mx-[1em] my-[1em] p-3 bg-card text-card-foreground rounded-2xl border border-border">
      {/* Back Button */}
      <Button
        onClick={() => router.back()}
        className="flex items-center text-muted-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-full h-full stroke-white" />
      </Button>

      <hr className="mb-6 border-border" />

      <div className="px-[2em]">
        <div className="flex items-center gap-6">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              className="w-20 h-20 rounded-full border-2 border-primary"
              width={80}
              height={80}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700" />
          )}

          <div>
            <h2 className="text-2xl font-bold">
              {profile.display_name || "No display name"}
            </h2>
            <p className="text-muted-foreground">
              @{profile.username || "no-username"}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bio</h3>
            <p className="text-muted-foreground text-base mt-1">
              {profile.bio || "No bio added yet."}
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Joined on:</span>{" "}
            {profile.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : "Unknown"}
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Last Login:</span>{" "}
            {profile.last_login
              ? new Date(profile.last_login).toLocaleString()
              : "Unknown"}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Button
          onClick={() => router.push("/edit-profile")}
          className="w-full"
        >
          Edit Profile
        </Button>
      </div>
    </div>
  );
}