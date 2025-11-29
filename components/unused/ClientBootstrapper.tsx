// "use client";

// import { useEffect } from "react";
// import { useUnifiedRoomStore } from "@/lib/store/roomstore";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import RoomInitializer from "@/lib/initialization/RoomInitializer";
// import ClientInitializer from "@/lib/initialization/clientinitializer";

// export default function ClientBootstrapper() {
//   const setUser = useUnifiedRoomStore((s) => s.setUser);

//   useEffect(() => {
//     const init = async () => {
//       const supabase = getSupabaseBrowserClient();
//       const { data } = await supabase.auth.getUser();

//       if (data?.user?.id) {
//         setUser({ id: data.user.id });
//       }
//     };

//     init();
//   }, [setUser]);

//   return (
//     <>
//       <ClientInitializer />
//       <RoomInitializer />
//     </>
//   );
// }
