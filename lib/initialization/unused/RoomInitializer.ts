// "use client";

// import { useEffect, useRef } from "react";
// import { useUnifiedRoomStore } from "@/lib/store/roomstore";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// export default function RoomInitializer() {
//   const initializedRef = useRef(false);

//   const user = useUnifiedRoomStore((state) => state.user);
//   const setUser = useUnifiedRoomStore((state) => state.setUser);
//   const fetchRooms = useUnifiedRoomStore((state) => state.fetchRooms);

//   useEffect(() => {
//     if (initializedRef.current) return;
//     initializedRef.current = true;

//     const loadUserAndRooms = async () => {
//       const supabase = getSupabaseBrowserClient();
//       const { data } = await supabase.auth.getUser();

//       if (data?.user?.id) {
//         setUser({ id: data.user.id });
//         console.log("🏁 RoomInitializer → User loaded:", data.user.id);
//         fetchRooms({ force: true });
//       }
//     };

//     loadUserAndRooms();
//   }, []);

//   return null;
// }
