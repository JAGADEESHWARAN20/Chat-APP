"use client";

import { Suspense, useEffect } from "react";
import ListMessages from "./ListMessages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { LIMIT_MESSAGE } from "@/lib/constant";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useMessage } from "@/lib/store/messages";
import { toast } from "sonner";
import { Imessage } from "@/lib/store/messages";

export default function ChatMessages() {
	const supabase = supabaseBrowser();
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
	const setMessages = useMessage((state) => state.setMessages);

	const fetchMessages = async () => {
		try {
			if (selectedRoom) {
				const { data, error } = await supabase
					.from("messages")
					.select("*, users(*)")
					.eq("room_id", selectedRoom.id)
					.range(0, LIMIT_MESSAGE)
					.order("created_at", { ascending: false });

				if (error) throw error;

				const formattedMessages: Imessage[] = data?.reverse().map((msg) => ({
					id: msg.id,
					created_at: msg.created_at,
					is_edit: msg.is_edit,
					send_by: msg.send_by,
					text: msg.text,
					room_id: msg.room_id,
					direct_chat_id: msg.direct_chat_id,
					dm_thread_id: msg.dm_thread_id,
					status: msg.status,
					users: msg.users || null,
				})) || [];

				setMessages(formattedMessages);
			} else if (selectedDirectChat) {
				const { data, error } = await supabase
					.from("messages")
					.select("*, users(*)")
					.eq("direct_bs", selectedDirectChat.id)
					.range(0, LIMIT_MESSAGE)
					.order("created_at", { ascending: false });

				if (error) throw error;

				const formattedMessages: Imessage[] = data?.reverse().map((msg) => ({
					id: msg.id,
					created_at: msg.created_at,
					is_edit: msg.is_edit,
					send_by: msg.send_by,
					text: msg.text,
					room_id: msg.room_id,
					direct_chat_id: msg.direct_chat_id,
					dm_thread_id: msg.dm_thread_id,
					status: msg.status,
					users: msg.users || null,
				})) || [];

				setMessages(formattedMessages);
			} else {
				setMessages([]);
			}
		} catch (error) {
			toast.error("Failed to fetch messages");
			console.error("Error fetching messages:", error);
		}
	};

	useEffect(() => {
		fetchMessages();
	}, [selectedRoom, selectedDirectChat]);

	return (
		<Suspense fallback={"loading..."}>
			<ListMessages />
		</Suspense>
	);
}