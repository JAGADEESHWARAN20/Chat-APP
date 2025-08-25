// import { IRoom } from '@/lib/types/rooms';
// import { SupabaseClient } from '@supabase/supabase-js';

// export async function createRoom(
//     supabase: SupabaseClient,
//     name: string,
//     isPrivate: boolean,
//     userId: string
// ): Promise<IRoom> {
//     const timestamp = '2025-04-18 07:19:39';

//     // Create the room
//     const { data: room, error: roomError } = await supabase
//         .from('rooms')
//         .insert({
//             name,
//             is_private: isPrivate,
//             created_by: userId,
//             created_at: timestamp
//         })
//         .select()
//         .single();

//     if (roomError) throw roomError;
//     if (!room) throw new Error('Failed to create room');

//     // Add creator as room member
//     const { error: memberError } = await supabase
//         .from('room_members')
//         .insert({
//             room_id: room.id,
//             user_id: userId,
//             status: 'accepted',
//             joined_at: timestamp
//         });

//     if (memberError) {
//         // Cleanup the room if member creation fails
//         await supabase.from('rooms').delete().eq('id', room.id);
//         throw memberError;
//     }

//     return {
//         id: room.id,
//         name: room.name,
//         is_private: room.is_private,
//         created_by: room.created_by,
//         created_at: room.created_at
//     };
// }