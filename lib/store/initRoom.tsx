// Optional: Create InitRoom if fetching rooms server-side
// lib/store/InitRoom.tsx
"use client";

import { useRef, useEffect } from "react";
import { useRoomStore } from "./roomstore";
import { IRoom } from "@/components/RoomList";

function InitRoom({ rooms }: { rooms: IRoom[] }) {
     const initState = useRef(false);

     useEffect(() => {
          if (!initState.current) {
               useRoomStore.setState({ rooms });
               // Optionally select the first room if needed
               // if (rooms.length > 0) {
               //   useRoomStore.setState({ selectedRoom: rooms[0] });
               // }
          }
          initState.current = true;
          // eslint-disable-next-line
     }, [rooms]); // Depend on rooms prop

     return null;
}

export default InitRoom;