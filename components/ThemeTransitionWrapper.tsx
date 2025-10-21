"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useState, createContext, useContext, useRef, useEffect } from "react";

interface ThemeTransitionContextValue {
  triggerTransition: (x: number, y: number, nextTheme: string) => void;
  isDark: boolean;
}

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

export function useThemeTransition() {
  const ctx = useContext(ThemeTransitionContext);
  if (!ctx) throw new Error("useThemeTransition must be used inside ThemeTransitionWrapper");
  return ctx;
}

export default function ThemeTransitionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [transitionState, setTransitionState] = useState<{
    active: boolean;
    nextTheme: string;
  }>({
    active: false,
    nextTheme: "light",
  });

  useEffect(() => {
    if (!transitionState.active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "010101010101";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = transitionState.nextTheme === "dark" 
        ? "rgba(0, 0, 0, 0.05)" 
        : "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = transitionState.nextTheme === "dark" ? "#0F0" : "#00F";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);

    return () => clearInterval(interval);
  }, [transitionState]);

  const triggerTransition = (x: number, y: number, nextTheme: string) => {
    setTransitionState({ active: true, nextTheme });

    setTimeout(() => {
      setTransitionState(prev => ({ ...prev, active: false }));
      setTheme(nextTheme);
    }, 1200);
  };

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark }}>
      <div className={`transition-colors duration-500 ${theme}`}>
        {children}
      </div>

      <AnimatePresence>
        {transitionState.active && (
          <motion.div
            className="fixed inset-0 z-[99999] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Matrix Rain Canvas */}
            <canvas
              ref={canvasRef}
              className="w-full h-full"
            />
            
            {/* Center portal effect */}
            <motion.div
              className="absolute rounded-full"
              style={{
                background: transitionState.nextTheme === "dark" 
                  ? "radial-gradient(circle, transparent 30%, hsl(224 71.4% 4.1%) 70%)"
                  : "radial-gradient(circle, transparent 30%, hsl(0 0% 100%) 70%)",
                left: '50%',
                top: '50%',
              }}
              initial={{
                width: 0,
                height: 0,
                x: "-50%",
                y: "-50%",
                scale: 0,
              }}
              animate={{
                width: "100vmax",
                height: "100vmax",
                scale: 1,
              }}
              transition={{
                duration: 1.2,
                ease: "easeOut",
              }}
            />

            {/* Mode Label - Centered */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 200, 
                    damping: 15,
                    delay: 0.4 
                  }}
                  className={`
                    text-6xl md:text-8xl lg:text-9xl font-bold
                    bg-gradient-to-r 
                    ${transitionState.nextTheme === "dark" 
                      ? "from-green-400 via-emerald-300 to-teal-400" 
                      : "from-blue-400 via-sky-300 to-cyan-400"
                    }
                    bg-clip-text text-transparent
                    drop-shadow-2xl
                    mb-4
                  `}
                >
                  MODE
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className={`
                    text-2xl md:text-4xl font-semibold
                    ${transitionState.nextTheme === "dark" 
                      ? "text-green-300" 
                      : "text-blue-300"
                    }
                    drop-shadow-lg
                    tracking-wider
                  `}
                >
                  {transitionState.nextTheme === "dark" ? "DARK" : "LIGHT"}
                </motion.div>

                {/* Animated dots */}
                <motion.div 
                  className="flex justify-center gap-2 mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className={`
                        w-2 h-2 rounded-full
                        ${transitionState.nextTheme === "dark" 
                          ? "bg-green-400" 
                          : "bg-blue-400"
                        }
                      `}
                      animate={{ 
                        scale: [1, 1.5, 1],
                        opacity: [0.7, 1, 0.7]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </motion.div>
              </div>
            </motion.div>

            {/* Corner accents */}
            <motion.div
              className="absolute top-4 left-4 text-sm font-mono opacity-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className={transitionState.nextTheme === "dark" ? "text-green-400" : "text-blue-400"}>
                SYSTEM_TRANSITION
              </div>
              <div className={transitionState.nextTheme === "dark" ? "text-green-300" : "text-blue-300"}>
                {transitionState.nextTheme.toUpperCase()}_MODE_ACTIVE
              </div>
            </motion.div>

            <motion.div
              className="absolute bottom-4 right-4 text-sm font-mono opacity-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className={transitionState.nextTheme === "dark" ? "text-green-400" : "text-blue-400"}>
                THEME_SWITCH_v2.0
              </div>
              <div className={transitionState.nextTheme === "dark" ? "text-green-300" : "text-blue-300"}>
                {transitionState.nextTheme === "dark" ? "NIGHT_VISION" : "DAY_MODE"}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeTransitionContext.Provider>
  );
}