"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/types/supabase"
import Image from "next/image"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

// The Profile type from your Supabase database schema
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

  if (!profile) return (
    <div className="p-4 text-center text-gray-800 dark:text-gray-200">
      Loading profile...
    </div>
  )

  return (
    <div className="max-w-xl mx-auto  p-3 bg-card text-card-foreground shadow-xl rounded-2xl border border-border">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        <span className="text-base font-medium">Back</span>
      </button>
      <hr className="mb-6 border-border"/>

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
          <p className="text-muted-foreground">@{profile.username || "no-username"}</p>
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
      </div>

      {/* ✅ Edit Profile Button */}
      <div className="mt-8">
        <Button onClick={() => router.push("/edit-profile")} className="w-full">
          Edit Profile
        </Button>
      </div>
    </div>
  )
}