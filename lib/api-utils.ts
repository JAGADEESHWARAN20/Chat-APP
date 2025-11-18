// lib/api-utils.ts (Updated withAuth to be callable HOC)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/types/supabase";

// Environment detection
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// Rate limiting (in-memory; consider Redis for production SaaS scale)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// SECURE withAuth: HOC pattern (returns function that takes request) + getUser() for verification
export function withAuth<T extends { user: any; supabase: any }>(
  handler: (params: T) => Promise<NextResponse>
) {
  return async (request: NextRequest) => { // ← Returns async function for route
    try {
      const cookieStore = cookies();
      const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignore if called from Server Component (no mutable cookies)
              }
            },
          },
        }
      );
      
      // SECURE: Use getUser() to verify JWT (contacts Supabase Auth server)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.warn('[Auth] Verification failed:', { error: authError?.message });
        return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
      }
      
      // Optional: Apply rate limiting (keyed by user ID)
      try {
        await withRateLimit(user.id); // Throws APIError if exceeded
      } catch (rateError) {
        if (rateError instanceof APIError && rateError.statusCode === 429) {
          return createAPIError(rateError);
        }
        throw rateError;
      }
      
      return await handler({ user, supabase } as T);
    } catch (error) {
      console.error('[withAuth] Error:', error);
      return errorResponse('Authentication failed', 'AUTH_FAILED', 401);
    }
  };
}

// Rate limiting (unchanged)
export async function withRateLimit(identifier: string): Promise<void> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  // Cleanup expired entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < windowStart) {
      rateLimitMap.delete(key);
    }
  }
  
  const current = rateLimitMap.get(identifier) || { count: 0, resetTime: now };
  
  if (current.resetTime < windowStart) {
    current.count = 0;
    current.resetTime = now;
  }
  
  current.count++;
  
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', {
      remaining: 0,
      reset: RATE_LIMIT_WINDOW
    });
  }
  
  rateLimitMap.set(identifier, current);
}

// Response helpers (unchanged)
export function successResponse<T = any>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): NextResponse {
  // Security: Strip any internal fields
  const safeData = { ...data } as any;
  delete safeData.internal; // Customize as needed
  
  return NextResponse.json(
    { success: true, ...safeData },
    { status, headers }
  );
}

export function errorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  details?: any
): NextResponse {
  // Security: Never expose stack traces or internals in production
  const safeDetails = isDevelopment && details ? details : undefined;
  
  return NextResponse.json(
    { 
      success: false,
      error: message, 
      code,
      ...(safeDetails && { details: safeDetails })
    },
    { status }
  );
}

// Alias for createAPIResponse to maintain compatibility
export const createAPIResponse = successResponse;

export function createAPIError(error: APIError | Error): NextResponse {
  if (error instanceof APIError) {
    return errorResponse(
      error.message, 
      error.code || 'API_ERROR', 
      error.statusCode, 
      error.details
    );
  }
  
  console.error('Unhandled API error:', error);
  return errorResponse(
    'Internal server error',
    'INTERNAL_ERROR',
    500,
    isDevelopment ? { message: error.message } : undefined
  );
}

// Validation functions (unchanged)
export function validateUUID(value: string, fieldName: string = 'ID'): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new APIError(`Invalid ${fieldName} format`, 400, 'INVALID_UUID', { value });
  }
}

export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new APIError(`${fieldName} is required`, 400, 'MISSING_REQUIRED_FIELD', { fieldName });
  }
}

export function validateMessageText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new APIError('Message text is required', 400, 'EMPTY_MESSAGE');
  }
  if (text.length > 2000) {
    throw new APIError('Message text too long (max 2000 chars)', 400, 'MESSAGE_TOO_LONG', { length: text.length });
  }
  // Security: Basic sanitization (escape HTML/JS)
  if (text.includes('<script>') || text.includes('</script>')) {
    throw new APIError('Invalid message content', 400, 'INVALID_CONTENT');
  }
}

// Validation schemas (unchanged)
export const validationSchemas = {
  uuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  roomId: (value: string) => validationSchemas.uuid(value),
  userId: (value: string) => validationSchemas.uuid(value),
  messageText: (text: string) => text && text.trim().length > 0 && text.length <= 2000,
};