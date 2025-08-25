"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface RoomContextType {
  currentRoom: string | null;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  previousRoom: string | null;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [previousRoom, setPreviousRoom] = useState<string | null>(null);

  const joinRoom = (roomId: string) => {
    setPreviousRoom(currentRoom);
    setCurrentRoom(roomId);
    localStorage.setItem("activeRoom", roomId);
  };

  const leaveRoom = () => {
    setCurrentRoom(null);
    localStorage.removeItem("activeRoom");
  };

  useEffect(() => {
    const cachedRoom = localStorage.getItem("activeRoom");
    if (cachedRoom) setCurrentRoom(cachedRoom);
  }, []);

  return (
    <RoomContext.Provider value={{ currentRoom, joinRoom, leaveRoom, previousRoom }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoomContext = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
};
