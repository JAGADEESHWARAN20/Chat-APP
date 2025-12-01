// import { Button } from "./ui/button";
// import { Switch } from "./ui/switch";
// import type { RoomData } from "@/lib/store/unified-roomstore";

// export type RoomWithMembership = RoomData & {
//   participation_status: "pending" | "accepted" | "rejected" | null;
//   is_member: boolean;
//   member_count: number;
// };

// type RoomActionButtonProps = {
//   room: RoomWithMembership;
//   selectedRoom?: RoomWithMembership;
//   onSwitch: (room: RoomWithMembership) => void;
//   onLeave: () => void;
//   onJoin: (room: RoomWithMembership) => void;
// };

// export default function RoomActionButton({
//   room,
//   selectedRoom,
//   onSwitch,
//   onLeave,
//   onJoin,
// }: RoomActionButtonProps) {
//   if (room.participation_status === "pending") {
//     return <span className="text-sm text-yellow-400">Pending</span>;
//   }

//   if (room.participation_status === "accepted") {
//     return (
//       <Switch
//         checked={selectedRoom?.id === room.id}
//         onCheckedChange={(checked) => {
//           if (checked) onSwitch(room);
//           else if (selectedRoom?.id === room.id) onLeave();
//         }}
//         className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-600"
//       />
//     );
//   }

//   return (
//     <Button
//       size="sm"
//       className="bg-indigo-600 hover:bg-indigo-700 text-white"
//       onClick={() => onJoin(room)}
//     >
//       Join
//     </Button>
//   );
// }
