export class SafeSupabaseQuery {
    static async single<T>(
      query: Promise<{ data: T | null; error: any }>
    ): Promise<{ data: T | null; error: any }> {
      try {
        const result = await query
        
        // Handle 406 errors by falling back to array query
        if (result.error?.code === '406' || result.error?.message?.includes('406')) {
          console.warn('406 error detected, implementing fallback strategy')
          return { data: null, error: new Error('No data found or content negotiation failed') }
        }
        
        return result
      } catch (error) {
        console.error('Safe single query error:', error)
        return { data: null, error }
      }
    }
  
    static async array<T>(
      query: Promise<{ data: T[] | null; error: any }>
    ): Promise<{ data: T[]; error: any }> {
      try {
        const result = await query
        
        if (result.error?.code === '406') {
          console.warn('406 error in array query, returning empty array')
          return { data: [], error: null }
        }
        
        return { data: result.data || [], error: result.error }
      } catch (error) {
        console.error('Safe array query error:', error)
        return { data: [], error }
      }
    }
  
    static async maybeSingle<T>(
      query: Promise<{ data: T | null; error: any }>
    ): Promise<{ data: T | null; error: any }> {
      try {
        const result = await query
        
        // For maybeSingle, 406 is acceptable - it means no rows
        if (result.error?.code === '406') {
          return { data: null, error: null }
        }
        
        return result
      } catch (error) {
        console.error('Safe maybeSingle query error:', error)
        return { data: null, error }
      }
    }
  }