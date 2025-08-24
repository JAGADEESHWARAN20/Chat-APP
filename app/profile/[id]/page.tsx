"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/types/supabase"
import Image from "next/image"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export default function ProfilePage() {
  const supabase = createClientComponentClient<Database>()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, bio, created_at, updated_at, avatar_url")
          .eq("id", user.id)
          .single()


        if (error) {
          console.error("Error fetching profile:", error)
        } else {
          setProfile({
            id: data.id,
            username: data.username,
            display_name: data.display_name,
            bio: data.bio,
            created_at: data.created_at,
            updated_at: data.updated_at ?? null, // <-- Fix here
            avatar_url: data.avatar_url
          });

        }
      }
    }

    getProfile()
  }, [supabase])

  if (!profile) return <div className="p-4">Loading profile...</div>

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white shadow rounded-lg">
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt="Avatar"
            className="w-16 h-16 rounded-full border"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300" />
        )}
        <div>
          <h2 className="text-xl font-semibold">
            {profile.display_name || "No display name"}
          </h2>
          <p className="text-gray-600">@{profile.username || "no-username"}</p>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-medium">Bio</h3>
        <p className="text-gray-700">
          {profile.bio || "No bio added yet."}
        </p>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Joined on:{" "}
        {profile.created_at
          ? new Date(profile.created_at).toLocaleDateString()
          : "Unknown"}
      </div>
    </div>
  )
}
