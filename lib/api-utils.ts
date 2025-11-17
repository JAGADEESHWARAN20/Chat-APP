// lib/api-utils.ts - COMPLETE VERSION
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Environment detection
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
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

// 🚀 ULTRA-FAST withAuth (FIXES AUTHENTICATION ISSUES)
export async function withAuth(
  handler: (params: { user: any; supabase: any }) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // 🚀 OPTIMIZED: Create client with minimal cookie operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false, // 🚀 Critical for performance
          autoRefreshToken: false,
        },
        cookies: {
          getAll() {
            try {
              return cookies().getAll();
            } catch {
              return [];
            }
          },
          setAll() {
            // 🚀 No-op to avoid dynamic server errors
            return;
          },
        },
      }
    );
    
    // 🚀 CRITICAL FIX: Use getUser() instead of getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('🚫 Authentication failed:', userError?.message);
      const authTime = Date.now() - startTime;
      console.log(`⏱️ Auth check took: ${authTime}ms`);
      return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
    }
    
    const authTime = Date.now() - startTime;
    console.log(`✅ User authenticated: ${user.id} (${authTime}ms)`);
    
    return await handler({ user, supabase });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 Auth error (${totalTime}ms):`, error);
    return errorResponse('Authentication failed', 'AUTH_FAILED', 401);
  }
}

// 🚀 RATE LIMITING (MISSING EXPORTS ADDED BACK)
export async function withRateLimit(identifier: string): Promise<void> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  // Clean up old entries
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
    throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
  }
  
  rateLimitMap.set(identifier, current);
}

// 🚀 ULTRA-FAST Response Helpers
export function successResponse<T = any>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status, headers }
  );
}

export function errorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    { 
      success: false,
      error: message, 
      code,
      ...(isDevelopment && details && { details })
    },
    { status }
  );
}

// 🚀 VALIDATION FUNCTIONS (MISSING EXPORTS ADDED BACK)
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(value: string, fieldName: string = 'ID'): void {
  if (!UUID_REGEX.test(value)) {
    throw new APIError(`Invalid ${fieldName} format`, 400, 'INVALID_UUID');
  }
}

export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new APIError(`${fieldName} is required`, 400, 'MISSING_REQUIRED_FIELD');
  }
}

export function validateMessageText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new APIError('Message text is required', 400, 'EMPTY_MESSAGE');
  }
  if (text.length > 2000) {
    throw new APIError('Message text too long', 400, 'MESSAGE_TOO_LONG');
  }
}

// 🚀 VALIDATION SCHEMAS (MISSING EXPORTS ADDED BACK)
export const validationSchemas = {
  uuid: (value: string) => UUID_REGEX.test(value),
  roomId: (value: string) => validationSchemas.uuid(value),
  userId: (value: string) => validationSchemas.uuid(value),
  messageText: (text: string) => text && text.trim().length > 0 && text.length <= 2000,
};

// 🚀 COMPATIBILITY ALIASES
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
    isDevelopment ? error.message : undefined
  );
}

// lib/api-utils.ts
// import { createServerClient } from "@supabase/ssr";
// import { cookies } from "next/headers";
// import { NextResponse } from "next/server";
// import { Database } from "@/lib/types/supabase";

// // Environment detection
// export const isProduction = process.env.NODE_ENV === 'production';
// export const isDevelopment = process.env.NODE_ENV === 'development';

// // Rate limiting
// const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
// const RATE_LIMIT_WINDOW = 60000;
// const RATE_LIMIT_MAX_REQUESTS = 100;

// export class APIError extends Error {
//   constructor(
//     message: string,
//     public statusCode: number = 500,
//     public code?: string,
//     public details?: any
//   ) {
//     super(message);
//     this.name = 'APIError';
//   }
// }

// // Enhanced withAuth that returns NextResponse
// export async function withAuth(
//   handler: (params: { user: any; supabase: any }) => Promise<NextResponse>
// ): Promise<NextResponse> {
//   try {
//     const cookieStore = cookies();
//     const supabase = createServerClient(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//       {
//         cookies: {
//           getAll() {
//             return cookieStore.getAll();
//           },
//           setAll(cookiesToSet) {
//             try {
//               cookiesToSet.forEach(({ name, value, options }) =>
//                 cookieStore.set(name, value, options)
//               );
//             } catch {
//               // Ignore if called from Server Component
//             }
//           },
//         },
//       }
//     );
    
//     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
//     if (sessionError || !session?.user) {
//       return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
//     }
    
//     return await handler({ user: session.user, supabase });
//   } catch (error) {
//     console.error('Auth error:', error);
//     return errorResponse('Authentication failed', 'AUTH_FAILED', 401);
//   }
// }

// export async function withRateLimit(identifier: string): Promise<void> {
//   const now = Date.now();
//   const windowStart = now - RATE_LIMIT_WINDOW;
  
//   for (const [key, value] of rateLimitMap.entries()) {
//     if (value.resetTime < windowStart) {
//       rateLimitMap.delete(key);
//     }
//   }
  
//   const current = rateLimitMap.get(identifier) || { count: 0, resetTime: now };
  
//   if (current.resetTime < windowStart) {
//     current.count = 0;
//     current.resetTime = now;
//   }
  
//   current.count++;
  
//   if (current.count > RATE_LIMIT_MAX_REQUESTS) {
//     throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
//   }
  
//   rateLimitMap.set(identifier, current);
// }

// // Response helpers
// export function successResponse<T = any>(
//   data: T,
//   status: number = 200,
//   headers: Record<string, string> = {}
// ): NextResponse {
//   return NextResponse.json(
//     { success: true, ...data },
//     { status, headers }
//   );
// }

// export function errorResponse(
//   message: string,
//   code: string = 'INTERNAL_ERROR',
//   status: number = 500,
//   details?: any
// ): NextResponse {
//   return NextResponse.json(
//     { 
//       success: false,
//       error: message, 
//       code,
//       ...(isDevelopment && details && { details })
//     },
//     { status }
//   );
// }

// // Alias for createAPIResponse to maintain compatibility
// export const createAPIResponse = successResponse;

// export function createAPIError(error: APIError | Error): NextResponse {
//   if (error instanceof APIError) {
//     return errorResponse(
//       error.message, 
//       error.code || 'API_ERROR', 
//       error.statusCode, 
//       error.details
//     );
//   }
  
//   console.error('Unhandled API error:', error);
//   return errorResponse(
//     'Internal server error',
//     'INTERNAL_ERROR',
//     500,
//     isDevelopment ? error.message : undefined
//   );
// }

// // Validation functions
// export function validateUUID(value: string, fieldName: string = 'ID'): void {
//   if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
//     throw new APIError(`Invalid ${fieldName} format`, 400, 'INVALID_UUID');
//   }
// }

// export function validateRequired(value: any, fieldName: string): void {
//   if (value === undefined || value === null || value === '') {
//     throw new APIError(`${fieldName} is required`, 400, 'MISSING_REQUIRED_FIELD');
//   }
// }

// export function validateMessageText(text: string): void {
//   if (!text || text.trim().length === 0) {
//     throw new APIError('Message text is required', 400, 'EMPTY_MESSAGE');
//   }
//   if (text.length > 2000) {
//     throw new APIError('Message text too long', 400, 'MESSAGE_TOO_LONG');
//   }
// }

// // Validation schemas
// export const validationSchemas = {
//   uuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
//   roomId: (value: string) => validationSchemas.uuid(value),
//   userId: (value: string) => validationSchemas.uuid(value),
//   messageText: (text: string) => text && text.trim().length > 0 && text.length <= 2000,
// };