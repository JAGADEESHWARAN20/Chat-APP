'use client';

import React, { createContext, useContext, useState, ReactNode } from "react";

interface UIState {
  joiningRoomId: string | null;
  switchingRoomId: string | null;
  leavingRoomId: string | null;
  setJoiningRoomId: (id: string | null) => void;
  setSwitchingRoomId: (id: string | null) => void;
  setLeavingRoomId: (id: string | null) => void;
}

const UIContext = createContext<UIState | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [switchingRoomId, setSwitchingRoomId] = useState<string | null>(null);
  const [leavingRoomId, setLeavingRoomId] = useState<string | null>(null);

  return (
    <UIContext.Provider
      value={{
        joiningRoomId,
        switchingRoomId,
        leavingRoomId,
        setJoiningRoomId,
        setSwitchingRoomId,
        setLeavingRoomId,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within a UIProvider");
  }
  return context;
}; 