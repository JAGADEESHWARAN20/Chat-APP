"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { ChevronLeft } from "lucide-react"; // 👈 import chevron

export default function EditProfilePage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form fields
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");

  // load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to load profile:", error);
      } else if (profile) {
        setDisplayName(profile.display_name || "");
        setUsername(profile.username || "");
        setAvatarUrl(profile.avatar_url || "");
        setBio(profile.bio || "");
      }

      setLoading(false);
    };

    loadProfile();
  }, [supabase, router]);

  // save profile
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        username,
        avatar_url: avatarUrl,
        bio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile.");
    } else {
      alert("Profile updated!");
      router.refresh();
    }
  };

  if (loading) return <p className="p-4">Loading profile...</p>;

  return (
    <div className="max-w-lg mx-auto p-6">
      {/* 👇 Chevron left button */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-black mb-4"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-4">Edit Profile</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Display Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter display name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Avatar URL</label>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Enter avatar URL"
          />
          {avatarUrl && (
            <Image
              src={avatarUrl}
              alt="avatar preview"
              className="w-16 h-16 rounded-full mt-2"
              width={64}
              height={64}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Bio</label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write something about yourself..."
          />
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
