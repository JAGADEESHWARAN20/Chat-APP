// lib/types/supabase-helpers.ts
import { Database } from './supabase'
import { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload, RealtimePostgresDeletePayload } from '@supabase/supabase-js'

// Helper types for real-time payloads
export type MessageInsertPayload = RealtimePostgresInsertPayload<Database['public']['Tables']['messages']['Row']>
export type MessageUpdatePayload = RealtimePostgresUpdatePayload<Database['public']['Tables']['messages']['Row']>
export type MessageDeletePayload = RealtimePostgresDeletePayload<Database['public']['Tables']['messages']['Row']>

// Type guard for message payloads
export function isMessageInsertPayload(payload: any): payload is MessageInsertPayload {
  return payload && payload.eventType === 'INSERT' && payload.table === 'messages'
}

export function isMessageUpdatePayload(payload: any): payload is MessageUpdatePayload {
  return payload && payload.eventType === 'UPDATE' && payload.table === 'messages'
}

export function isMessageDeletePayload(payload: any): payload is MessageDeletePayload {
  return payload && payload.eventType === 'DELETE' && payload.table === 'messages'
}