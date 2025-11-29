// "use client";

// import { useEffect } from "react";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { useUser } from "@/lib/store/user";

// export default function SecureInitUser() {
//   const setUser = useUser((s) => s.setUser);
//   const clearUser = useUser((s) => s.clearUser);

//   useEffect(() => {
//     const supabase = getSupabaseBrowserClient();

//     const loadUser = async () => {
//       // ✅ verified fetch
//       const { data, error } = await supabase.auth.getUser();

//       if (error || !data.user) {
//         clearUser();
//         return;
//       }

//       await setUser(data.user);
//     };

//     loadUser();

//     // ✅ Also handle realtime auth changes safely
//     const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
//       if (session?.access_token) {
//         const { data } = await supabase.auth.getUser();
//         await setUser(data.user);
//       } else {
//         clearUser();
//       }
//     });

//     return () => {
//       listener.subscription.unsubscribe();
//     };
//   }, [setUser, clearUser]);

//   return null;
// }

// // "use client";
// // import { User } from "@supabase/supabase-js";
// // import { useEffect, useRef } from "react";
// // import { useUser } from "../store/user";

// // export default function InitUser({ user }: { user: User | undefined }) {
// //   const initState = useRef(false);

// //   useEffect(() => {
// //     if (!initState.current && user) {
// //       useUser.getState().setUser(user);
// //     }
// //     initState.current = true;
// //   }, [user]);

// //   return null;
// // }
