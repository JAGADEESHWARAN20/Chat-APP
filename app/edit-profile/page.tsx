// app/edit-profile/page.tsx
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { ChevronLeft, User, Edit3, Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import AvatarCropperUI, { type CropperRef } from "@/components/AvatarCropperUI";
import { Area, Point } from "react-easy-crop";
import { cn } from "@/lib/utils"; // Assuming you have a cn utility for className merging

const LIMIT_MB = 10; // Max file size in MB
const MAX_BIO_LENGTH = 200;

export default function EditProfilePage() {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  /* ---------- State ---------- */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [bioLength, setBioLength] = useState(0);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState(""); // Data URL of picked image
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const cropperRef = useRef<CropperRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- Load Profile ---------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profile) {
          setDisplayName(profile.display_name || "");
          setUsername(profile.username || "");
          setOriginalUsername(profile.username || "");
          setAvatarUrl(profile.avatar_url || "");
          setBio(profile.bio || "");
          setBioLength(profile.bio?.length || 0);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        toast.error("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, router]);

  /* ---------- Username Validation (Debounced) ---------- */
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username && username !== originalUsername) {
        const available = await checkUsernameUnique(username);
        setUsernameAvailable(available);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, originalUsername]);

  const checkUsernameUnique = useCallback(async (name: string): Promise<boolean> => {
    if (!name || name === originalUsername) return true;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", name)
        .neq("id", user.id)
        .single();
      const isUnique = !data;
      if (!isUnique) {
        toast.error("Username is already taken.");
      }
      return isUnique;
    } catch (error) {
      console.error("Username check failed:", error);
      toast.error("Failed to check username availability.");
      return false;
    }
  }, [supabase, originalUsername]);

  /* ---------- Crop & Create Square File ---------- */
  const createSquareImage = useCallback(async (): Promise<void> => {
    const pixels = cropperRef.current?.getCroppedArea();
    if (!pixels || !cropSrc) {
      toast.error("No crop area selected.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const img = document.createElement("img") as HTMLImageElement;
      img.src = cropSrc;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });

      const size = Math.min(pixels.width, pixels.height);
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(
        img,
        pixels.x + (pixels.width - size) / 2,
        pixels.y + (pixels.height - size) / 2,
        size,
        size,
        0,
        0,
        size,
        size
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("Failed to process image.");
            return;
          }
          const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
          setAvatarFile(file);
          setAvatarUrl(URL.createObjectURL(file));
          setCropSrc("");
          toast.success("Avatar cropped successfully!", { icon: <CheckCircle className="w-4 h-4" /> });
        },
        "image/jpeg",
        0.9 // High quality for premium look
      );
    } catch (error) {
      console.error("Crop failed:", error);
      toast.error("Failed to crop image. Please try again.");
    }
  }, [cropSrc]);

  /* ---------- Avatar Upload with Progress ---------- */
  const uploadAvatar = useCallback(async (): Promise<string> => {
    if (!avatarFile) return avatarUrl;
    setUploading(true);
    setUploadProgress(0);

    const body = new FormData();
    body.append("file", avatarFile);

    try {
      const res = await fetch("/api/upload-avatar", { 
        method: "POST", 
        body,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = await res.json();
      setUploadProgress(100);
      if (!data.url) {
        throw new Error("No URL returned from upload.");
      }
      toast.success("Avatar uploaded successfully!", { icon: <CheckCircle className="w-4 h-4" /> });
      return data.url;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed. Please try again.", { icon: <AlertCircle className="w-4 h-4" /> });
      return avatarUrl;
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  }, [avatarFile, avatarUrl]);

  /* ---------- Save Profile with Validation ---------- */
  const handleSave = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Client-side validation
    if (!displayName.trim()) {
      toast.error("Display name is required.", { icon: <AlertCircle className="w-4 h-4" /> });
      return;
    }
    if (!username.match(/^[a-zA-Z0-9_]{3,20}$/)) {
      toast.error("Username must be 3-20 characters, alphanumeric or underscore only.", { icon: <AlertCircle className="w-4 h-4" /> });
      return;
    }
    if (bio.length > MAX_BIO_LENGTH) {
      toast.error(`Bio must be ≤ ${MAX_BIO_LENGTH} characters.`, { icon: <AlertCircle className="w-4 h-4" /> });
      return;
    }
    if (username !== originalUsername && usernameAvailable === false) {
      toast.error("Username is not available.", { icon: <AlertCircle className="w-4 h-4" /> });
      return;
    }

    setSaving(true);

    try {
      const finalAvatar = await uploadAvatar();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: username.trim(),
          avatar_url: finalAvatar,
          bio: bio.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        console.error("Update error:", error);
        throw new Error(error.message || "Failed to update profile.");
      }

      toast.success("Profile updated successfully!", { icon: <CheckCircle className="w-4 h-4" /> });
      setOriginalUsername(username);
      router.refresh();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save profile. Please try again.", { icon: <AlertCircle className="w-4 h-4" /> });
    } finally {
      setSaving(false);
    }
  }, [displayName, username, bio, originalUsername, usernameAvailable, supabase, router, uploadAvatar]);

  /* ---------- File Pick with Validation ---------- */
  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > LIMIT_MB * 1024 * 1024) {
      toast.error(`File size must be under ${LIMIT_MB} MB.`, { icon: <AlertCircle className="w-4 h-4" /> });
      e.target.value = ""; // Reset input
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.", { icon: <AlertCircle className="w-4 h-4" /> });
      e.target.value = "";
      return;
    }

    const src = URL.createObjectURL(file);
    setCropSrc(src);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAvatarFile(null); // Reset until cropped
    toast.info("Image selected. Crop to proceed.", { duration: 2000 });
  }, []);

  const handleAvatarEditClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleBioChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBio(value);
    setBioLength(value.length);
  }, []);

  /* ---------- Enhanced Loading Skeleton ---------- */
  if (loading)
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4 space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex items-center space-x-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-10 w-3/4 rounded-md" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
            <Skeleton className="h-12 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Enhanced Header with Animations */}
      <div className="flex items-center justify-between animate-slide-in">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
          disabled={saving || uploading}
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <Badge variant="outline" className="text-sm border-primary/50 bg-gradient-to-r from-primary/5 to-secondary/5">
          Premium Editor
        </Badge>
      </div>

      <Card className="border-0 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 pb-6">
          <CardTitle className="text-3xl font-bold flex items-center gap-3">
            <User className="w-8 h-8 text-primary" />
            Edit Your Profile
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Make your profile stand out with a custom avatar and bio.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-6" noValidate>
            {/* Display Name - Enhanced with Icon */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name or nickname"
                disabled={saving || uploading}
                required
                maxLength={50}
                className="h-12 pr-10 focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
                aria-describedby="displayName-help"
              />
              <p id="displayName-help" className="text-xs text-muted-foreground">
                How you appear to others
              </p>
            </div>

            {/* Username - With Real-time Availability Badge */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base font-semibold flex items-center gap-2">
                <span className="text-primary">@</span> Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourusername"
                  disabled={saving || uploading}
                  required
                  className={cn(
                    "h-12 pl-8",
                    usernameAvailable === false && "border-destructive focus-visible:ring-destructive",
                    usernameAvailable === true && "border-green-500 focus-visible:ring-green-500"
                  )}
                  aria-describedby="username-help"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">@</span>
              </div>
              {usernameAvailable !== null && (
                <Badge
                  variant={usernameAvailable ? "default" : "destructive"}
                  className="text-xs animate-pulse"
                >
                  {usernameAvailable ? "Available! ✓" : "Taken ❌"}
                </Badge>
              )}
              <p id="username-help" className="text-xs text-muted-foreground">
                3-20 characters, letters, numbers, underscores only
              </p>
            </div>

            {/* Avatar - Premium Hover Effects & Direct Crop */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Profile Avatar</Label>
              <Separator />
              <div className="relative group">
                <div className="relative">
                  <Avatar className="w-28 h-28 border-4 border-background shadow-lg ring-4 ring-transparent group-hover:ring-primary/30 transition-all duration-300 transform group-hover:scale-105">
                    <AvatarImage src={avatarUrl} alt="Profile avatar" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-background text-2xl font-bold">
                      {displayName.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <Edit3 className="w-6 h-6 text-white" />
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute -bottom-2 -right-2 rounded-full w-10 h-10 bg-background border-2 border-border shadow-lg group-hover:bg-primary group-hover:border-primary transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
                      onClick={handleAvatarEditClick}
                      disabled={saving || uploading}
                      aria-label="Edit avatar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[450px] p-0 max-h-[90vh] overflow-hidden">
                    <div className="p-6 pb-0 flex flex-col h-full">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Upload className="w-5 h-5" />
                          Select New Avatar
                        </DialogTitle>
                      </DialogHeader>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onFilePick}
                        disabled={saving || uploading}
                        className="mx-0 mt-4 hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="mx-4 mt-4 border-2 border-dashed border-muted-foreground hover:border-primary"
                        onClick={handleAvatarEditClick}
                        disabled={saving || uploading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Image ({LIMIT_MB}MB max)
                      </Button>
                      {uploading && (
                        <div className="mx-4 mt-4 space-y-2">
                          <Progress value={uploadProgress} className="h-2" />
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Uploading... {Math.round(uploadProgress)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Square images work best (1:1 aspect ratio)
              </p>
            </div>

            {/* Bio - With Character Counter & Auto-resize */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-base font-semibold">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={handleBioChange}
                placeholder="Share a bit about yourself – interests, story, or a fun fact!"
                disabled={saving || uploading}
                maxLength={MAX_BIO_LENGTH}
                className="min-h-[120px] resize-none pr-10 focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
                aria-describedby="bio-counter"
              />
              <div className="flex justify-between items-center text-xs">
                <p className="text-muted-foreground">Markdown supported</p>
                <Badge variant={bioLength > MAX_BIO_LENGTH * 0.8 ? "destructive" : "secondary"}>
                  {bioLength}/{MAX_BIO_LENGTH}
                </Badge>
              </div>
            </div>

            {/* Enhanced Submit Button */}
            <Separator />
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group"
              disabled={saving || uploading || loading}
              aria-label="Save profile changes"
            >
              <span className="flex items-center gap-2">
                {saving || uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin group-hover:animate-spin-slow" />
                    {saving ? "Saving Changes..." : "Uploading Avatar..."}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Save Profile
                  </>
                )}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Enhanced Cropper Dialog - Full Premium Experience */}
      <Dialog open={!!cropSrc} onOpenChange={() => setCropSrc("")}>
        <DialogContent className="sm:max-w-[550px] max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Crop Your Avatar
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Drag to pan, scroll to zoom. Square crop recommended.</p>
          </DialogHeader>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 relative bg-gradient-to-br from-muted to-muted/50">
              <AvatarCropperUI
                ref={cropperRef}
                imageSrc={cropSrc}
                crop={crop}
                zoom={zoom}
                onCropChange={setCrop}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-6 pt-4 border-t bg-background flex items-center justify-between">
              <div className="flex-1 pr-4">
                <Label htmlFor="zoom-slider" className="text-sm font-medium block mb-1">
                  Zoom: {Math.round(zoom * 100)}%
                </Label>
                <input
                  id="zoom-slider"
                  type="range"
                  min={1}
                  max={4}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider premium-slider"
                  aria-label="Adjust zoom level"
                />
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button onClick={createSquareImage} size="sm" className="font-semibold">
                  Apply Crop
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}