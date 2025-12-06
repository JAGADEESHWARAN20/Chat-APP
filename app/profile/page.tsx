// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function MyProfilePage() {
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
    };

    load();
  }, [supabase]);

  if (!profile)
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-40 mb-6" />
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>
    );

  return (
    <div className="mx-[1em] my-[1em] p-3 bg-card text-card-foreground rounded-2xl border border-border">
      <Button
        onClick={() => router.back()}
        className="flex w-[3.5em] h-[3.5em] p-[1.5em] items-center rounded-full text-muted-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-[2em] h-[2em]  stroke-white" />
      </Button>

      <div className="flex items-center gap-6">
        <Image
          src={profile.avatar_url || "/default-avatar.png"}
          width={80}
          height={80}
          alt="avatar"
          className="rounded-full border"
        />
        <div>
          <h2 className="text-xl font-bold">
            {profile.display_name || profile.username}
          </h2>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Bio</h3>
        <p className="text-muted-foreground">
          {profile.bio || "No bio yet"}
        </p>
      </div>

      <div className="mt-8">
        <Button className="w-full" onClick={() => router.push("/edit-profile")}>
          Edit Profile
        </Button>
      </div>
    </div>
  );
}
