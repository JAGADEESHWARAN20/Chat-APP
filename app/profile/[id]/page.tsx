"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/types/supabase"
import Image from "next/image"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export default function ProfilePage() {
  const supabase = createClientComponentClient<Database>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const router = useRouter()

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
        } else if (data) {
          setProfile({
            id: data.id,
            username: data.username,
            display_name: data.display_name,
            bio: data.bio,
            created_at: data.created_at,
            updated_at: data.updated_at ?? null,
            avatar_url: data.avatar_url,
          })
        }
      }
    }

    getProfile()
  }, [supabase])

  if (!profile) return <div className="p-4">Loading profile...</div>

  return (
    <div className="max-w-xl mx-auto mt-6 p-6 bg-white shadow rounded-lg">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-black mb-4"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        Back
      </button>

      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt="Avatar"
            className="w-16 h-16 rounded-full border"
            width={64}
            height={64}
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
        <p className="text-gray-700">{profile.bio || "No bio added yet."}</p>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Joined on:{" "}
        {profile.created_at
          ? new Date(profile.created_at).toLocaleDateString()
          : "Unknown"}
      </div>

      {/* ✅ Edit Profile Button */}
      <div className="mt-6">
        <Button onClick={() => router.push("/edit-profile")} className="w-full">
          Edit Profile
        </Button>
      </div>
    </div>
  )
}
