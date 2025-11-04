"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Github, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database } from "@/database.types";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  // FIX: Use createBrowserClient instead of createClientComponentClient
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      // First create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: fullName,
            username: username.toLowerCase(),
          },
        },
      });

      if (signUpError) {
        toast.error(signUpError.message);
        setIsLoading(false);
        return;
      }

      // Then create the public user profile
      if (authData.user) {
        const { error: profileError } = await supabase.from('users').insert([
          {
            id: authData.user.id,
            display_name: fullName,
            username: username.toLowerCase(),
            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`,
          },
        ]);

        if (profileError) {
          toast.error("Error creating user profile");
          setIsLoading(false);
          return;
        }
      }

      toast.success("Registration successful! Please verify your email.");
      router.push("/auth/login");
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred during registration");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthRegister = async (provider: 'github' | 'google') => {
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
      toast.error(`An error occurred during ${provider} registration`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md p-6 space-y-6 bg-card rounded-lg shadow-lg border border-border gradient-border">
        <div className="glass-gradient-header p-4 rounded-lg">
          <h2 className="text-2xl font-bold text-center text-card-foreground">Create an Account</h2>
          <p className="text-muted-foreground text-center mt-1">Sign up to get started with Chat App</p>
        </div>

        <form onSubmit={handleEmailRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-[var(--radius)] focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-[var(--radius)] focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-[var(--radius)] focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-[var(--radius)] focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-[var(--radius)] focus:ring-2 focus:ring-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="glass-button w-full bg-primary text-primary-foreground border-none"
          >
            {isLoading ? "Creating account..." : "Create account"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthRegister('github')}
            className="w-full border border-gray-600 hover:bg-gray-800"
          >
            <Github className="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthRegister('google')}
            className="w-full border border-gray-600 hover:bg-gray-800"
          >
            <Mail className="mr-2 h-4 w-4" />
            Google
          </Button>
        </div>
        <p className="text-center text-gray-400">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-500 hover:text-blue-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}