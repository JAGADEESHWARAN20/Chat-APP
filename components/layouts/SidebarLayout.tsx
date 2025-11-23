// // components/sidebar/SidebarLayout.tsx
// "use client";

// import React, { ReactNode, useMemo, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { createBrowserClient } from "@supabase/ssr";

// import {
//   Sidebar,
//   SidebarProvider,

//   SidebarInset,
//   useSidebar,
// } from "@/components/sidebar";

// import RightSidebarContent from "@/components/sidebar/RightSidebarContent";




// import { useUser } from "@/lib/store/user";
// import type { Database } from "@/database.types";
// import { cn } from "@/lib/utils";

// import { ThemeTransitionWrapper } from "@/components/ThemeTransitionWrapper";

// type Props = {
//   children: ReactNode;
//   side?: "left" | "right";
//   onSidebarToggle?: () => void;
//   sidebarState?: any;
// };



// function LayoutContents({ children, side = "right", onSidebarToggle }: Props) {
//   const router = useRouter();

//   const isMobile =
//     typeof window !== "undefined"
//       ? window.matchMedia("(max-width: 768px)").matches
//       : false;

//   const sidebarWidth = isMobile ? 260 : 320;

 
  

//   const { state, toggleSidebar } = useSidebar();

//   useEffect(() => {
//     const toggle = () => toggleSidebar();
//     window.addEventListener("toggle-settings-sidebar", toggle);
//     return () =>
//       window.removeEventListener("toggle-settings-sidebar", toggle);
//   }, [toggleSidebar]);

//   const handleToggle = () => {
//     if (onSidebarToggle) onSidebarToggle();
//     else toggleSidebar();
//   };

//   const collapsed = state !== "expanded";
//   const transformStyle =
//     side === "right"
//       ? `translateX(${collapsed ? sidebarWidth : 0}px)`
//       : `translateX(${collapsed ? -sidebarWidth : 0}px)`;

//   return (
//     <div
//       className={cn(
//         "min-h-screen flex",
//         side === "right" ? "flex-row-reverse" : "flex-row",
//         "bg-[hsl(var(--background))]"
//       )}
//     >
//       <Sidebar
//         side={side}
//         className={cn(
//           "fixed top-0 bottom-0 z-[500] pointer-events-none",
//           side === "right" ? "right-0" : "left-0"
//         )}
//       >
//         {/* mobile overlay */}
//         <div
//           className={cn(
//             "fixed inset-0 z-[490] transition-opacity duration-200",
//             collapsed ? "opacity-0 pointer-events-none" : "opacity-60 pointer-events-auto"
//           )}
//           style={{
//             background: "rgba(0,0,0,0.45)",
//             display: isMobile ? "block" : "none",
//           }}
//           onClick={handleToggle}
//         />

//         {/* Sidebar container (keeps size/translate logic) */}
//         <div
//           style={{
//             width: sidebarWidth,
//             transform: transformStyle,
//             transition: "transform 260ms cubic-bezier(.2,.9,.2,1)",
//           }}
//           className={cn(
//             "h-full pointer-events-auto",
//             "will-change-transform",
//             collapsed ? "pointer-events-none" : "pointer-events-auto"
//           )}
//           role="region"
  
//         >
//           {/* If this layout is used for right-side behavior, render the shared RightSidebarContent */}
//           {side === "right" ? (
//             <RightSidebarContent width={sidebarWidth} onClose={handleToggle} />
//           ) : (
//             /* For left side (if ever used here) you may want to keep existing content inline.
//                For now we render the same RightSidebarContent for consistency; swap with left content
//                if you want a distinct left sidebar implementation. */
//             <RightSidebarContent width={sidebarWidth} onClose={handleToggle} />
//           )}
//         </div>
//       </Sidebar>

//       <SidebarInset className="flex-1">
//         <div className="flex-1 overflow-auto">{children}</div>
//       </SidebarInset>
//     </div>
//   );
// }

// export default function SidebarLayout({ children, side = "right", onSidebarToggle }: Props) {
//   return (
//     <ThemeTransitionWrapper>
//       <SidebarProvider defaultOpen={false}>
//         <LayoutContents side={side} onSidebarToggle={onSidebarToggle}>
//           {children}
//         </LayoutContents>
//       </SidebarProvider>
//     </ThemeTransitionWrapper>
//   );
// }
