// app/auth/callback/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Quick fail
  if (!code) return NextResponse.redirect(`${origin}/auth/auth-code-error`);

  // server client to set session cookie on the browser
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

  // exchange code for session
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("exchangeCodeForSession error:", exchangeError);
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  // The server-side "service" client to upsert profile (use service role)
  const service = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // get the user from the session returned by exchange
  const user = exchangeData?.session?.user;
  if (!user) {
    console.error("No user returned from exchangeData");
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  try {
    // upsert profile (id must match auth.users.id)
    await service.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.full_name ?? user.email ?? "User",
        avatar_url:
          user.user_metadata?.avatar_url ??
          `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(
            user.email ?? user.id
          )}`,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.error("Failed to upsert profile:", err);
    // We do not block login flow for profile upsert failure — send to error page instead
    // return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  // success: redirect to next (origin + next)
  return NextResponse.redirect(`${origin}${next}`);
}
