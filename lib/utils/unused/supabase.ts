// import { supabaseBrowser } from "@/lib/supabase/browser";
// import { SupabaseClient } from "@supabase/supabase-js";

// export const checkRoomMembership = async (
//      supabase: SupabaseClient,
//      userId: string | undefined,
//      roomId: string
// ): Promise<boolean> => {
//      if (!userId) return false;
//      const { data, error } = await supabase
//           .from("room_participants")
//           .select("status")
//           .eq("room_id", roomId)
//           .eq("user_id", userId)
//           .eq("status", "accepted")
//           .single();
//      if (error && error.code !== "PGRST116") {
//           console.error("[checkRoomMembership] Error:", error);
//           return false;
//      }
//      return data?.status === "accepted";
// };