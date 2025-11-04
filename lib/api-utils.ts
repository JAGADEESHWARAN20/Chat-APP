import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Database } from "@/lib/types/supabase";

export class APIError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

export async function withAuth<T = any>(
  handler: (props: {
    supabase: ReturnType<typeof createRouteHandlerClient<Database>>;
    user: { id: string };
    session: any;
  }) => Promise<NextResponse<T>>
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    return await handler({ supabase, user: session.user, session });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed", code: "AUTH_FAILED" },
      { status: 401 }
    );
  }
}

export function validateUUID(id: string, fieldName: string = "ID") {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(id)) {
    throw new APIError(`Invalid ${fieldName} format`, 400, `INVALID_${fieldName.toUpperCase()}`);
  }
}

export function successResponse(data: any = { success: true }) {
  return NextResponse.json({ success: true, ...data });
}

export function errorResponse(error: string, code?: string, status: number = 500) {
  return NextResponse.json({ success: false, error, code }, { status });
}