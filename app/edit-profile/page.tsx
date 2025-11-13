"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress"; // Assume you have a Progress component; add if not (from shadcn/ui)

export default function EditProfilePage() {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState(""); // To detect changes
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // For upload

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

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
        toast.error("Failed to load profile.");
      } else if (profile) {
        setDisplayName(profile.display_name || "");
        setUsername(profile.username || "");
        setOriginalUsername(profile.username || "");
        setAvatarUrl(profile.avatar_url || "");
        setBio(profile.bio || "");
      }

      setLoading(false);
    };

    loadProfile();
  }, [supabase, router]);

  // Check username uniqueness
  const checkUsernameUnique = async (newUsername: string) => {
    if (!newUsername || newUsername === originalUsername) return true; // No change or empty

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Authentication error or no user:", authError);
      toast.error("Error checking username availability due to authentication issue.");
      return false;
    }

    const excludeId = user.id; // assign after verifying user exists

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", newUsername)
      .neq("id", excludeId) // exclude current user's id (now guaranteed string)
      .single();

    if (error && (error as any).code !== "PGRST116") { // PGRST116: No rows
      console.error("Username check error:", error);
      toast.error("Error checking username availability.");
      return false;
    }
    if (data) {
      toast.error("Username is already taken.");
      return false;
    }
    return true;
  };
  // Handle avatar upload
  const handleAvatarUpload = async () => {
    if (!avatarFile) return avatarUrl; // Keep old avatar if nothing uploaded
  
    setUploading(true);
    setUploadProgress(10);
  
    try {
      const formData = new FormData();
      formData.append("file", avatarFile);
  
      // Hit Cloudinary upload API
      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });
  
      const data = await res.json();
  
      if (!data.url) {
        toast.error("Failed to upload avatar.");
        return avatarUrl;
      }
  
      // Update UI
      setUploadProgress(90);
      setAvatarUrl(data.url);
  
      return data.url; // Return Cloudinary URL
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to upload avatar.");
      return avatarUrl;
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };
  

  // Save profile
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!displayName.trim()) {
      toast.error("Display name is required.");
      return;
    }
    if (!username.match(/^[a-zA-Z0-9_]{3,20}$/)) {
      toast.error("Username must be 3-20 alphanumeric characters or underscores.");
      return;
    }
    if (bio.length > 200) {
      toast.error("Bio must be under 200 characters.");
      return;
    }

    // Check username unique
    if (!(await checkUsernameUnique(username))) return;

    setSaving(true);

    // Upload avatar if new file
    const finalAvatarUrl = await handleAvatarUpload();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.id) { // Check both user and user.id
      setSaving(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        username: username.trim(),
        avatar_url: finalAvatarUrl,
        bio: bio.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id); // Now safe as user.id is guaranteed to exist

    setSaving(false);

    if (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile.");
    } else {
      toast.success("Profile updated!");
      setOriginalUsername(username); // Update original
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <Skeleton className="h-6 w-24 mb-4" />
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-20 w-20 rounded-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-black mb-4"
        disabled={saving || uploading}
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
            disabled={saving || uploading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => checkUsernameUnique(username)} // Check on blur
            placeholder="Enter username"
            disabled={saving || uploading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Avatar</label>
          {avatarUrl && (
            <Image
              src={avatarUrl}
              alt="Avatar preview"
              className="w-16 h-16 rounded-full mb-2"
              width={64}
              height={64}
            />
          )}
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            disabled={saving || uploading}
          />
          {uploading && <Progress value={uploadProgress} className="mt-2" />}
        </div>

        <div>
          <label className="block text-sm font-medium">Bio</label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write something about yourself..."
            disabled={saving || uploading}
            maxLength={200}
          />
        </div>

        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Saving..." : uploading ? "Uploading..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}