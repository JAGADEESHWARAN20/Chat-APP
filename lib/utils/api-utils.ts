// lib/utils/api-utils.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from "@/lib/types/supabase";

export async function getAuthenticatedUser() {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session?.user) {
    throw new Error("Unauthorized");
  }
  
  return { user: session.user, supabase };
}

export function handleApiError(error: any, context: string) {
  console.error(`💥 API Error in ${context}:`, error);
  
  if (error.message === "Unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return Response.json(
    { 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    { status: 500 }
  );
}