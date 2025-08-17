"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function EditProfilePage() {
  const supabase = createClientComponentClient<Database>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.from("profiles").select("*").single();
      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  async function updateProfile() {
    if (!profile) return;

    await supabase.from("profiles").update({
      display_name: profile.display_name,
      bio: profile.bio, // ✅ update bio
    }).eq("id", profile.id);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-4">Edit Profile</h1>

      <input
        className="border rounded w-full p-2 mb-3"
        type="text"
        placeholder="Display name"
        value={profile?.display_name ?? ""}
        onChange={(e) =>
          setProfile((prev) =>
            prev ? { ...prev, display_name: e.target.value } : prev
          )
        }
      />

      <textarea
        className="border rounded w-full p-2 mb-3"
        placeholder="Your bio"
        rows={4}
        value={profile?.bio ?? ""}
        onChange={(e) =>
          setProfile((prev) =>
            prev ? { ...prev, bio: e.target.value } : prev
          )
        }
      />

      <button
        onClick={updateProfile}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Save
      </button>
    </div>
  );
}
