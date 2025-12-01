// "use client";

// import React, { useMemo } from "react";
// import { useRouter } from "next/navigation";
// import { createBrowserClient } from "@supabase/ssr";
// import type { User as SupabaseUser } from "@supabase/supabase-js";
// import type { Database } from "@/database.types";
// import { Button } from "@/components/ui/button";
// import { useUser } from "@/lib/store/user";

// interface Props { user?: SupabaseUser | null; }

// export default function LoginLogoutButton({ user }: Props) {
//   const router = useRouter();
//   const supabase = useMemo(
//     () => createBrowserClient<Database>(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//     ), []
//   );

//   const storeUser = useUser((s) => s.user);
//   const currentUser = user || storeUser;

//   const displayName = useMemo(() => {
//     if (!currentUser) return "User";
//     return (
//       (currentUser.user_metadata as any)?.display_name ||
//       (currentUser.user_metadata as any)?.username ||
//       currentUser.email?.split("@")[0] ||
//       "User"
//     );
//   }, [currentUser]);

//   const handleLogout = async () => {
//     await supabase.auth.signOut();
//     router.replace("/");
//   };

//   if (!currentUser) {
//     return (
//       <div className="flex items-center gap-2">
//         <Button variant="ghost" size="sm" onClick={() => router.push("/auth/login")}>
//           Sign In
//         </Button>
//         <Button variant="default" size="sm" onClick={() => router.push("/auth/register")}>
//           Sign Up
//         </Button>
//       </div>
//     );
//   }

//   return (
//     <div className="flex items-center gap-2">
//       <button
//         aria-label="Open profile"
//         onClick={() => router.push(`/profile/${currentUser.id}`)}
//         className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-[hsl(var(--muted))]/20 transition"
//       >
//         <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-green-400 flex items-center justify-center text-white font-bold">
//           {displayName.charAt(0).toUpperCase()}
//         </div>
//         <div className="hidden sm:flex flex-col text-left">
//           <span className="text-sm font-medium leading-none">{displayName}</span>
//           <span className="text-xs text-muted-foreground leading-none">{currentUser.email}</span>
//         </div>
//       </button>

//       <Button variant="ghost" size="sm" onClick={handleLogout}>
//         Sign Out
//       </Button>
//     </div>
//   );
// }
