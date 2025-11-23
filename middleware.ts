import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // 1. Create an initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 2. Update the request cookies (so the Server Components see the new session)
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          
          // 3. Update the response cookies (so the Browser saves the new session)
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 4. Refresh the session if expired
  // IMPORTANT: getUser() validates the JWT with Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 5. Protected Routes Logic
  // If user is NOT logged in and trying to access the dashboard
  if (!user && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // 6. Auth Routes Logic
  // If user IS logged in and trying to access Login/Register, kick them to Dashboard
  if (user && request.nextUrl.pathname.startsWith("/auth")) {
    // Exception: Allow /auth/callback to run to finish OAuth flows
    if (!request.nextUrl.pathname.startsWith("/auth/callback")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};