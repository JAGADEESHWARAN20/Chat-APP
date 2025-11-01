// Simple token estimation (rough approximation)
export const estimateTokens = (text: string): number => {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  };
  
  export const isWithinTokenLimit = (text: string, limit: number): boolean => {
    return estimateTokens(text) <= limit;
  };
  
  export const tokenLimit = {
    'gpt-3.5-turbo': 4096,
    'gpt-4': 8192,
    'gpt-4o-mini': 128000,
  } as const;