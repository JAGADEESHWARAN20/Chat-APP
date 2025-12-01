// // hooks/usePerformanceOptimizations.ts - NEW
// "use client";

// import { useCallback, useRef } from 'react';

// export function useThrottledCallback<T extends (...args: any[]) => any>(
//   callback: T,
//   delay: number
// ): T {
//   const lastRun = useRef(Date.now());
//   const timeoutRef = useRef<NodeJS.Timeout>();

//   return useCallback((...args: Parameters<T>) => {
//     const now = Date.now();
//     const timeSinceLastRun = now - lastRun.current;

//     if (timeSinceLastRun >= delay) {
//       callback(...args);
//       lastRun.current = now;
//     } else {
//       clearTimeout(timeoutRef.current);
//       timeoutRef.current = setTimeout(() => {
//         callback(...args);
//         lastRun.current = Date.now();
//       }, delay - timeSinceLastRun);
//     }
//   }, [callback, delay]) as T;
// }

// export function useDebouncedCallback<T extends (...args: any[]) => any>(
//   callback: T,
//   delay: number
// ): T {
//   const timeoutRef = useRef<NodeJS.Timeout>();

//   return useCallback((...args: Parameters<T>) => {
//     clearTimeout(timeoutRef.current);
//     timeoutRef.current = setTimeout(() => callback(...args), delay);
//   }, [callback, delay]) as T;
// }