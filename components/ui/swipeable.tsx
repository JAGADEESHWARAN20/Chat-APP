// components/ui/swipeable.tsx
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface SwipeableProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
  className?: string;
  enableMouseEvents?: boolean;
}

export const Swipeable: React.FC<SwipeableProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 50,
  className = "",
  enableMouseEvents = false,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle end of transition to reset styles
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTransitionEnd = () => {
      setIsAnimating(false);
      setTranslateX(0);
    };

    element.addEventListener("transitionend", handleTransitionEnd);
    return () => element.removeEventListener("transitionend", handleTransitionEnd);
  }, []);

  const handleStart = useCallback((x: number) => {
    startXRef.current = x;
    isSwipingRef.current = true;
  }, []);

  const handleMove = useCallback((x: number) => {
    if (!isSwipingRef.current || startXRef.current === null) return;
    const deltaX = x - startXRef.current;
    setTranslateX(deltaX);
  }, []);

  const handleEnd = useCallback(() => {
    if (!isSwipingRef.current || startXRef.current === null) return;

    isSwipingRef.current = false;

    if (Math.abs(translateX) > swipeThreshold) {
      if (translateX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }

    setIsAnimating(true);
    setTranslateX(0);
    startXRef.current = null;
  }, [translateX, swipeThreshold, onSwipeLeft, onSwipeRight]);

  // Touch Events
  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  // Optional Mouse Events (Desktop)
  const onMouseDown = (e: React.MouseEvent) => enableMouseEvents && handleStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => enableMouseEvents && handleMove(e.clientX);
  const onMouseUp = () => enableMouseEvents && handleEnd();

  return (
    <div
      ref={elementRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      className={`relative touch-none select-none ${className}`}
      style={{
        transform: `translateX(${translateX}px)`,
        transition: isAnimating ? "transform 0.3s ease" : "none",
      }}
    >
      {children}
    </div>
  );
};
