import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

export async function ensureSystemUserExists() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("id", SYSTEM_USER_ID)
    .single();

  if (data) return;

  const { error: insertError } = await supabase.from("users").insert({
    id: SYSTEM_USER_ID,
    username: "system",
    display_name: "System AI Assistant",
    avatar_url:
      "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=SystemBot",
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("⚠️ Failed to create system user:", insertError);
  } else {
    console.log("✅ Created System User (AI Assistant bot)");
  }
}
