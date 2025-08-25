"use client";

import React, { createContext, useContext, useState } from "react";

interface SearchHighlightContextType {
     highlightedMessageId: string | null;
     setHighlightedMessageId: (id: string | null) => void;
     searchQuery: string;
     setSearchQuery: (query: string) => void;
}

const SearchHighlightContext = createContext<SearchHighlightContextType | undefined>(undefined);

export function SearchHighlightProvider({ children }: { children: React.ReactNode }) {
     const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
     const [searchQuery, setSearchQuery] = useState("");

     return (
          <SearchHighlightContext.Provider value={{
               highlightedMessageId,
               setHighlightedMessageId,
               searchQuery,
               setSearchQuery,
          }}>
               {children}
          </SearchHighlightContext.Provider>
     );
}

export function useSearchHighlight() {
     const context = useContext(SearchHighlightContext);
     if (context === undefined) {
          throw new Error("useSearchHighlight must be used within a SearchHighlightProvider");
     }
     return context;
}
