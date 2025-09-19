import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
     try {
          const supabase = createRouteHandlerClient({ cookies });
          const { content, roomId } = await req.json();

          // Validate session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
               return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const userId = session.user.id;

          // Check if the user is a member of the room
          const { data: membership, error: membershipError } = await supabase
               .from("room_members")
               .select("*")
               .eq("room_id", roomId)
               .eq("user_id", userId)
               .eq("active", true) // 🔒 only allow active members
               .single();
          if (membershipError || !membership) {
               return NextResponse.json({ error: "You are not a member of this room" }, { status: 403 });
          }

          // Insert the message into the messages table
          const { data: message, error: messageError } = await supabase
               .from("messages")
               .insert({
                    content,
                    room_id: roomId,
                    user_id: userId,
                    created_at: new Date().toISOString(),
                    status: "sent",
               })
               .select()
               .single();
          if (messageError) {
               console.error("Error sending message:", messageError);
               return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
          }

          // Fetch room details to get the room name and creator
          const { data: room, error: roomError } = await supabase
               .from("rooms")
               .select("name, created_by")
               .eq("id", roomId)
               .single();
          if (roomError || !room) {
               return NextResponse.json({ error: "Room not found" }, { status: 404 });
          }

          // Fetch the sender's username
          const { data: user, error: userError } = await supabase
               .from("profiles")
               .select("username")
               .eq("id", userId)
               .single();
          if (userError || !user) {
               return NextResponse.json({ error: "User not found" }, { status: 404 });
          }

          // Fetch room members to notify (excluding the sender)
          const { data: members, error: membersError } = await supabase
               .from("room_members")
               .select("user_id")
               .eq("room_id", roomId)
               .neq("user_id", userId);
          if (membersError) {
               console.error("Error fetching room members:", membersError);
               return NextResponse.json({ error: "Failed to fetch room members" }, { status: 500 });
          }

          // Insert notifications for each member
          const notifications = members.map((member) => ({
               user_id: member.user_id,
               type: "message",
               room_id: roomId,
               sender_id: userId,
               message: `sent a message in ${room.name}: "${content}"`,
               status: "unread",
               created_at: new Date().toISOString(),
          }));

          const { error: notificationError } = await supabase
               .from("notifications")
               .insert(notifications);
          if (notificationError) {
               console.error("Error inserting notifications:", notificationError);
               // Continue, but log the error (non-critical)
          }

          return NextResponse.json({ success: true, message: "Message sent successfully" });
     } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Server error in messages route:", errorMessage, error);
          return NextResponse.json({ error: "Failed to send message", details: errorMessage }, { status: 500 });
     }
}