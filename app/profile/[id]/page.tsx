"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/database.types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClientComponentClient<Database>();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", params.id)
        .single();
      setProfile(data);
    };
    fetchProfile();
  }, [params.id, supabase]);

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex flex-col items-center">
        <Avatar className="w-24 h-24">
          <AvatarImage src={profile.avatar_url || ""} />
          <AvatarFallback>{profile.display_name?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <h1 className="mt-4 text-xl font-semibold">
          {profile.display_name || profile.email}
        </h1>
        <p className="text-muted-foreground">{profile.bio || "No bio yet"}</p>
        <Link href="/edit-profile">
          <Button className="mt-4">Edit Profile</Button>
        </Link>
      </div>
    </div>
  );
}
