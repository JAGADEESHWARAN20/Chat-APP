"use client";

import { Suspense } from "react";
import ListMessages from "./ListMessages";

interface ChatMessagesProps {
  searchQuery?: string;
  isSearching?: boolean;
  onSearchStateChange?: (searching: boolean) => void;
  onSearchTrigger?: () => void; // New prop
  isSearchExpanded?: boolean; // Add this line
}

export default function ChatMessages({ 
  searchQuery = "", 
  isSearching = false, 
  onSearchStateChange,
  onSearchTrigger,
  isSearchExpanded // Add this line
}: ChatMessagesProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading messages...
      </div>
    }>
 
<ListMessages
  searchQuery={searchQuery}
  isSearching={isSearching}
  onSearchStateChange={onSearchStateChange}
  onSearchTrigger={onSearchTrigger}
  isSearchExpanded={isSearchExpanded} // Pass it down
/>
    </Suspense>
  );
}
