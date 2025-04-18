"use client";

import { useRef, useEffect } from "react";
import { useRoomStore } from "./roomstore";
import { IRoom } from "@/lib/types/rooms"; // Update import path

function InitRoom({ rooms }: { rooms: IRoom[] }) {
     const initState = useRef(false);

     useEffect(() => {
          if (!initState.current) {
               useRoomStore.setState({ rooms });
          }
          initState.current = true;
          // eslint-disable-next-line
     }, [rooms]);

     return null;
}

export default InitRoom;