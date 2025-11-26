import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  // Exchange Supabase auth code
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("exchangeCodeForSession error:", exchangeError);
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const user = exchangeData?.session?.user;
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  // Service client
  const service = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    // Check if profile exists
    const { data: existing } = await service
      .from("profiles")
      .select("id, display_name, username")
      .eq("id", user.id)
      .maybeSingle();

    // Create empty profile (first login only)
    if (!existing) {
      await service.from("profiles").insert({
        id: user.id,
        created_at: new Date().toISOString(),
      });

      return NextResponse.redirect(`${origin}/edit-profile`);
    }

    // If profile exists but incomplete → force setup
    if (!existing.display_name || !existing.username) {
      return NextResponse.redirect(`${origin}/edit-profile`);
    }
  } catch (err) {
    console.error("Profile check failed:", err);
  }

  // Existing, valid user → continue
  return NextResponse.redirect(`${origin}${next}`);
}
