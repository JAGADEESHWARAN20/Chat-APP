"use client";
import { User } from "@supabase/supabase-js";
import React, { useEffect, useRef } from "react";
import { useUser } from "./user";

export default function InitUser({ user }: { user: User | undefined }) {
  const initState = useRef(false);

  useEffect(() => {
    if (!initState.current && user) {
      useUser.getState().setUser(user);
    }
    initState.current = true;
  }, [user]);

  return null;
}
