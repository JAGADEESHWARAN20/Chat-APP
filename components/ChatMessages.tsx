"use client";

import { Suspense, useEffect } from "react";
import ListMessages from "./ListMessages";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useMessage } from "@/lib/store/messages";
import { toast } from "sonner";
import { Imessage } from "@/lib/store/messages";

export default function ChatMessages() {
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
	const { setMessages, clearMessages } = useMessage((state) => ({
		setMessages: state.setMessages,
		clearMessages: state.clearMessages,
	}));

	const fetchMessages = async () => {
		try {
			// Clear existing messages before fetching new ones
			clearMessages();

			if (selectedRoom) {
				const response = await fetch(`/api/messages/${selectedRoom.id}`);
				if (!response.ok) throw new Error("Failed to fetch messages");
				const { messages } = await response.json();

				const formattedMessages: Imessage[] = messages.map((msg: any) => ({
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

				setMessages(formattedMessages.reverse());
			} else if (selectedDirectChat) {
				const response = await fetch(`/api/direct-messages/${selectedDirectChat.id}`);
				if (!response.ok) throw new Error("Failed to fetch direct messages");
				const { messages } = await response.json();

				const formattedMessages: Imessage[] = messages.map((msg: any) => ({
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

				setMessages(formattedMessages.reverse());
			} else {
				setMessages([]);
			}
		} catch (error) {
			if (error instanceof Error) {
				toast.error("Failed to fetch messages");
				console.error("Error fetching messages:", error.message);
			}
		}
	};

	useEffect(() => {
		fetchMessages();
	}, [selectedRoom, selectedDirectChat, clearMessages]);

	return (
		<Suspense fallback={"loading..."}>
			<ListMessages />
		</Suspense>
	);
}