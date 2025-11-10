import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Prepare an initial response
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ✅ Use new cookie API (`getAll` + `setAll`)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Optional: refresh the user's session (keeps Supabase cookies fresh)
  await supabase.auth.getSession();

  return response;
}

// ✅ Match all routes except static/image assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
