import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(req: NextRequest, { params }: { params: { notificationId: string } }) {
     const supabase = supabaseServer();
     const { notificationId } = params;

     // Get the authenticated user
     const { data: { user }, error: authError } = await supabase.auth.getUser();
     if (authError || !user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     // Delete the notification for the user
     const { error } = await supabase
          .from("notifications")
          .delete()
          .eq("id", notificationId)
          .eq("user_id", user.id);

     if (error) {
          return NextResponse.json({ error: error.message || "Failed to delete notification" }, { status: 500 });
     }

     return NextResponse.json({ message: "Notification deleted successfully" }, { status: 200 });
}