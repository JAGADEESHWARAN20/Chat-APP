import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(_req: NextRequest) {
     const supabase = await supabaseServer();

     // Get the authenticated user
     const { data: { user }, error: authError } = await supabase.auth.getUser();
     if (authError || !user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     // Delete all notifications for the user
     const { error } = await supabase
          .from("notifications")
          .delete()
          .eq("user_id", user.id);

     if (error) {
          return NextResponse.json({ error: error.message || "Failed to clear notifications" }, { status: 500 });
     }

     return NextResponse.json({ message: "All notifications cleared successfully" }, { status: 200 });
}