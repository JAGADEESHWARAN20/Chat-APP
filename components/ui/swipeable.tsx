// components/ui/swipeable.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';

interface SwipeableProps {
     children: React.ReactNode;
     onSwipeLeft?: () => void;
     onSwipeRight?: () => void;
     swipeThreshold?: number;
     className?: string;
}

export const Swipeable: React.FC<SwipeableProps> = ({
     children,
     onSwipeLeft,
     onSwipeRight,
     swipeThreshold = 50,
     className = '',
}) => {
     const [startX, setStartX] = useState<number | null>(null);
     const [currentX, setCurrentX] = useState<number | null>(null);
     const [isSwiping, setIsSwiping] = useState(false);
     const elementRef = useRef<HTMLDivElement>(null);

     const handleTouchStart = (e: React.TouchEvent) => {
          setStartX(e.touches[0].clientX);
          setCurrentX(e.touches[0].clientX);
          setIsSwiping(true);
     };

     const handleTouchMove = (e: React.TouchEvent) => {
          if (!isSwiping) return;
          setCurrentX(e.touches[0].clientX);
     };

     const handleTouchEnd = () => {
          if (!isSwiping || startX === null || currentX === null) return;

          const deltaX = currentX - startX;

          if (Math.abs(deltaX) > swipeThreshold) {
               if (deltaX < 0 && onSwipeLeft) {
                    onSwipeLeft();
               } else if (deltaX > 0 && onSwipeRight) {
                    onSwipeRight();
               }
          }

          setStartX(null);
          setCurrentX(null);
          setIsSwiping(false);
     };

     useEffect(() => {
          const element = elementRef.current;
          if (!element) return;

          // Reset position after animation
          const handleTransitionEnd = () => {
               if (element) {
                    element.style.transform = '';
               }
          };

          element.addEventListener('transitionend', handleTransitionEnd);
          return () => {
               element.removeEventListener('transitionend', handleTransitionEnd);
          };
     }, []);

     useEffect(() => {
          const element = elementRef.current;
          if (!element || startX === null || currentX === null) return;

          const deltaX = currentX - startX;
          element.style.transform = `translateX(${deltaX}px)`;
          element.style.transition = isSwiping ? 'none' : 'transform 0.3s ease';
     }, [currentX, isSwiping, startX]);

     return (
          <div
               ref={elementRef}
               onTouchStart={handleTouchStart}
               onTouchMove={handleTouchMove}
               onTouchEnd={handleTouchEnd}
               className={`relative ${className}`}
          >
               {children}
          </div>
     );
};