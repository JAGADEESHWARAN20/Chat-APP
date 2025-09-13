// This file previously declared message union types which conflicted
// with the canonical message type exported by the messages store.
// Re-export the authoritative types from the store to avoid duplicate
// definitions and TypeScript mismatches across the codebase.

// Import the canonical message types from the store and re-export them.
import type { MessageWithProfile, Imessage as _Imessage } from '@/lib/store/messages';

export type { MessageWithProfile };
export type Imessage = _Imessage;

// Backwards-compatible alias: many files referenced `DirectMessage`.
// Map it to the canonical Imessage to avoid converters all over the codebase.
export type DirectMessage = Imessage;