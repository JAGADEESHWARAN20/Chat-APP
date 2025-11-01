// types/gpt-tokenizer.d.ts
declare module 'gpt-tokenizer' {
    export function encode(text: string): number[];
    export function decode(tokens: number[]): string;
    export function isWithinTokenLimit(text: string, limit: number): boolean;
    export const tokenLimit: number;
  }