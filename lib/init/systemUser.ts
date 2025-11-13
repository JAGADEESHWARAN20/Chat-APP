// lib/init/systemUser.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

export async function ensureSystemUserExists(): Promise<string | null> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const SYSTEM_USER_ID = "ca9ff56d-a12a-4429-9f62-a78f03e3461c";

  // Check if profile exists
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", SYSTEM_USER_ID)
    .single();

  if (error || !profile) {
    console.log("⚠️ System profile missing. Creating...");
    
    const { error: insertError } = await supabase.from("profiles").insert({
      id: SYSTEM_USER_ID,
      username: "system",
      display_name: "System AI Assistant",
      avatar_url: "https://avatar.vercel.sh/system%40flychat.ai.svg?txt=sy",
      created_at: new Date().toISOString(),
    } as Database["public"]["Tables"]["profiles"]["Insert"]);

    if (insertError) {
      console.error("❌ Failed to create system profile:", insertError.message);
      return null;
    }
    
    console.log("✅ System profile ensured");
  }

  return SYSTEM_USER_ID;
}