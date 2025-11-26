"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Github, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Load user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Failed to load user session");
        return;
      }

      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .single();

      if (!profile?.display_name || !profile?.username) {
        router.push("/edit-profile");
        return;
      }

      toast.success("Logged in successfully!");
      router.push("/");
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "github" | "google") => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/auth/callback` },
      });

      if (error) toast.error(error.message);
    } catch (error) {
      console.error("Error:", error);
      toast.error(`An error occurred during ${provider} login`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-black/30 backdrop-blur-sm rounded-lg shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-center text-white">Welcome Back</h2>
          <p className="text-gray-400 text-center mt-2">Sign in to continue to Chat App</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-black/20 text-white border-gray-600"
            />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-black/20 text-white border-gray-600"
            />
          </div>

          <Button disabled={isLoading} className="w-full bg-blue-600 text-white">
            {isLoading ? "Signing in..." : "Sign in"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-black/30 px-2 text-gray-400">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => handleOAuthLogin("github")}>
            <Github className="mr-2 h-4 w-4" /> GitHub
          </Button>
          <Button variant="outline" onClick={() => handleOAuthLogin("google")}>
            <Mail className="mr-2 h-4 w-4" /> Google
          </Button>
        </div>

        <p className="text-center text-gray-400">
          Don’t have an account?{" "}
          <Link href="/auth/register" className="text-blue-500">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
