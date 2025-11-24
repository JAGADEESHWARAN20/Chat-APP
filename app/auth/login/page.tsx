"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
// import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Github, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// import { Database } from "@/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  // FIX: Use createBrowserClient instead of createClientComponentClient
  const supabase = getSupabaseBrowserClient(); // no createBrowserClient per file
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
        setIsLoading(false);
        return;
      }

      toast.success("Logged in successfully!");
      router.refresh();
      router.push("/");
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
      }
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-black/20 text-white border border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/auth/forgot-password" className="text-sm text-blue-500 hover:text-blue-400">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-black/20 text-white border border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? "Signing in..." : "Sign in"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-black/30 px-2 text-gray-400">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin('github')}
            className="w-full border border-gray-600 hover:bg-gray-800"
          >
            <Github className="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin('google')}
            className="w-full border border-gray-600 hover:bg-gray-800"
          >
            <Mail className="mr-2 h-4 w-4" />
            Google
          </Button>
        </div>

        <p className="text-center text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-blue-500 hover:text-blue-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}