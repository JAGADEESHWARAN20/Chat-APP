"use client";

import React from "react";
import { RoomProvider } from "@/lib/store/RoomContext";
import HomePage from "@/components/Homepage";

export default function Page() {
  return (
    <RoomProvider>
      <HomePage />
    </RoomProvider>
  );
}