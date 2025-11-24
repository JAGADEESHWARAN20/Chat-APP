// "use client";

// import React, { memo } from "react";
// import LeftSidebar from "@/components/LeftSidebar";
// import ClientChatContent from "@/components/ClientChatContent";
// import { User as SupabaseUser } from "@supabase/supabase-js";

// const ChatLayout = memo(function ChatLayout({
//   user,
//   isOpen,
//   onClose,
// }: {
//   user: SupabaseUser | undefined;
//   isOpen: boolean;
//   onClose?: () => void;
// }) {
//   console.log("ChatLayout rendering", { isOpen });

//   return (
//     <div className="flex-1 w-full flex transition-all duration-300 h-[100%]">
//       {/* ✅ normalized prop */}
//       <LeftSidebar user={user ? { id: user.id } : null} isOpen={isOpen} onClose={onClose} />
//       <div
//         className={`flex-1 w-full lg:max-w-[75vw] mx-auto h-[90vh] flex flex-col ${
//           isOpen ? "lg:ml-[25%]" : "lg:ml-0"
//         }`}
//       >
//         <ClientChatContent user={user} />
//       </div>
//     </div>
//   );
// });

// export default ChatLayout;
