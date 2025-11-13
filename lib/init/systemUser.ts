import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

export async function ensureSystemUserExists() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const SYSTEM_EMAIL = "system@flychat.ai";
  const SYSTEM_NAME = "System AI Assistant";

  // 1️⃣ Check existing auth users
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.email === SYSTEM_EMAIL);

  if (existing) {
    // ensure profile exists
    await supabase.from("profiles").upsert({
      id: existing.id,
      display_name: SYSTEM_NAME,
      avatar_url:
        "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=SystemBot",
    });
    return existing;
  }

  // 2️⃣ Create new auth user
  const { data: created, error: authError } =
    await supabase.auth.admin.createUser({
      email: SYSTEM_EMAIL,
      email_confirm: true,
    });

  if (authError || !created?.user) {
    console.error("❌ Failed to create system user:", authError?.message);
    return null;
  }

  // 3️⃣ Create matching profile (required by your schema)
  await supabase.from("profiles").insert({
    id: created.user.id,
    display_name: SYSTEM_NAME,
    avatar_url:
      "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=SystemBot",
  });

  console.log("✅ Created System AI Assistant User");
  return created.user;
}
