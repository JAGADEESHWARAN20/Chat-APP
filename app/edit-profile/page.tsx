"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function EditProfilePage() {
  const supabase = createClientComponentClient<Database>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase.from("profiles").select("*").single();
      if (error) {
        toast.error("Failed to load profile");
      }
      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  async function updateProfile() {
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        bio: profile.bio,
        username: profile.username,
        avatar_url: profile.avatar_url,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated successfully!");
    }

    setSaving(false);
    setOpenDialog(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">Profile Info</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Profile Info */}
            <TabsContent value="profile" className="space-y-4">
              <Input
                placeholder="Display name"
                value={profile?.display_name ?? ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, display_name: e.target.value } : prev
                  )
                }
              />

              <Input
                placeholder="Username"
                value={profile?.username ?? ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, username: e.target.value } : prev
                  )
                }
              />

              <Textarea
                placeholder="Your bio"
                rows={4}
                value={profile?.bio ?? ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, bio: e.target.value } : prev
                  )
                }
              />

   
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Change Avatar</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    {/* File upload instead of manual URL */}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !profile) return;

                        const fileExt = file.name.split(".").pop();
                        const filePath = `avatars/${profile.id}-${Date.now()}.${fileExt}`;

                        const { error: uploadError } = await supabase.storage
                          .from("avatars")
                          .upload(filePath, file, {
                            cacheControl: "3600",
                            upsert: true,
                          });

                        if (uploadError) {
                          toast.error("Failed to upload avatar");
                          return;
                        }

                        // Get public URL
                        const { data: urlData } = supabase.storage
                          .from("avatars")
                          .getPublicUrl(filePath);

                        if (urlData?.publicUrl) {
                          setProfile((prev) =>
                            prev ? { ...prev, avatar_url: urlData.publicUrl } : prev
                          );
                          toast.success("Avatar uploaded!");
                        }
                      }}
                    />

                    {profile?.avatar_url && (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar Preview"
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    )}
                  </div>
                </PopoverContent>
              </Popover>

            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings">
              <p className="text-muted-foreground">Future profile settings can go here.</p>
            </TabsContent>
          </Tabs>

          {/* Save Button with Dialog Confirm */}
          <div className="mt-6">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 text-white" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Update</DialogTitle>
                </DialogHeader>
                <p>Are you sure you want to save changes to your profile?</p>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setOpenDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={updateProfile} disabled={saving}>
                    {saving ? "Saving..." : "Confirm"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
