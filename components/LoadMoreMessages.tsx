// "use client";

// import React, { useState } from "react";
// import { Button } from "./ui/button";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { LIMIT_MESSAGE } from "@/lib/constant";
// import { getFromAndTo } from "@/lib/utils";
// import { Imessage, useMessage } from "@/lib/store/messages";
// import { toast } from "@/components/ui/sonner"
// import { useUnifiedRoomStore } from "@/lib/store/roomstore";
// import { MESSAGE_WITH_PROFILE_SELECT } from "@/lib/queries/messages";

// export default function LoadMoreMessages() {
//   const page = useMessage((state) => state.page);
//   const setMessages = useMessage((state) => state.setMessages);
//   const hasMore = useMessage((state) => state.hasMore);
//   const selectedRoom = useUnifiedRoomStore((state) => state.selectedRoomId);
//   const [loading, setLoading] = useState(false);

//   const fetchMore = async () => {
//     if (!selectedRoom) {
//       toast.error("No room selected");
//       return;
//     }

//     try {
//       setLoading(true);
//       const { from, to } = getFromAndTo(page, LIMIT_MESSAGE);
//       const supabase = getSupabaseBrowserClient();

//       console.log("[LoadMoreMessages] Fetching messages for room:", selectedRoom, { from, to });

//       const { data, error } = await supabase
//         .from("messages")
//         .select(MESSAGE_WITH_PROFILE_SELECT)
//         .eq("room_id", selectedRoom)
//         .range(from, to)
//         .order("created_at", { ascending: false })
//         .returns<Imessage[]>(); // ✅ ensures correct typing

//       if (error) {
//         console.error("[LoadMoreMessages] Supabase Query Error:", error);
//         throw error;
//       }

//       console.log("[LoadMoreMessages] Messages fetched:", data);

//       if (data && data.length > 0) {
//         // ✅ Reverse so oldest comes first
//         setMessages(data.reverse());
//       } else {
//         toast.info("No more messages to load.");
//       }
//     } catch (err: any) {
//       console.error("[LoadMoreMessages] Error:", err);
//       toast.error(err.message || "Failed to load messages");
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!hasMore) return null;

//   return (
//     <Button
//       variant="outline"
//       className="w-full"
//       onClick={fetchMore}
//       disabled={loading}
//     >
//       {loading ? "Loading..." : "Load More"}
//     </Button>
//   );
// }
