// app/profile/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useDirectChatActions } from "@/lib/hooks/useDirectChatActions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function OtherUserProfilePage() {
  const params = useParams();
  const userId = params?.id as string; // dynamic ID
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const { openOrCreateDirectChat } = useDirectChatActions();

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      setProfile(data);
    };

    load();
  }, [supabase, userId]);


  const handleMessageUser = async () => {
    if (!profile) return;

    setIsStartingChat(true);
    const opened = await openOrCreateDirectChat({
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    });
    setIsStartingChat(false);

    if (opened) {
      router.push("/");
    }
  };

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
        className="flex items-center mb-6 text-muted-foreground"
      >
        <ChevronLeft />
      </Button>

      <div className="flex items-center gap-6">
        <Image
          src={profile.avatar_url || "/default-avatar.png"}
          alt="Avatar"
          width={80}
          height={80}
          className="rounded-full border"
        />

        <div>
          <h2 className="text-xl font-semibold">
            {profile.display_name || profile.username}
          </h2>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>
      </div>

      <div className="mt-4">
        <Button
          onClick={handleMessageUser}
          disabled={isStartingChat}
          className="inline-flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          {isStartingChat ? "Opening..." : "Message"}
        </Button>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Bio</h3>
        <p className="text-muted-foreground">
          {profile.bio || "This user has no bio."}
        </p>
      </div>
    </div>
  );
}
