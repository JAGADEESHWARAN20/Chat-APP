"use client";

import React from "react";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "@/lib/store/user";
import {  useMessage } from "@/lib/store/messages";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";

export default function ChatInput() {
	const user = useUser((state) => state.user);
	const addMessage = useMessage((state) => state.addMessage);
	const setOptimisticIds = useMessage((state) => state.setOptimisticIds);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);

	const handleSendMessage = async (text: string) => {
		if (!text.trim()) {
			toast.error("Message cannot be empty");
			return;
		}
		if (!user) {
			toast.error("Please log in to send messages");
			return;
		}
		if (!selectedRoom && !selectedDirectChat) {
			toast.error("Please select a room or user to chat with");
			return;
		}

		const id = uuidv4();
		const newMessage = {
			id,
			text,
			sender_id: user.id,
			room_id: selectedRoom?.id || null,
			direct_chat_id: selectedDirectChat?.id || null,
			dm_thread_id: null,
			is_edited: false,
			created_at: new Date().toISOString(),
			status: "sent",
			users: {
				id: user.id,
				avatar_url: user.user_metadata.avatar_url || "",
				display_name: user.user_metadata.user_name || user.email || "",
				username: user.user_metadata.user_name || user.email?.split('@')[0] || "",
				created_at: new Date().toISOString(),
			}
		};

		// Optimistic update
		addMessage(newMessage);
		setOptimisticIds(id);

		try {
			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					text,
					room_id: selectedRoom?.id || null,
					direct_chat_id: selectedDirectChat?.id || null
				})
			});

			if (!response.ok) {
				throw new Error(await response.text());
			}
		} catch (error) {
			console.error("Error sending message:", error);
			toast.error("Failed to send message");
			useMessage.getState().optimisticDeleteMessage(id);
		}
	};

	return (
		<div className="p-5">
			<Input
				placeholder={
					selectedRoom
						? `Message #${selectedRoom.name}`
						: selectedDirectChat
							? "Send direct message"
							: "Select a room or user to start chatting"
				}
				onKeyDown={(e) => {
					if (e.key === "Enter" && e.currentTarget.value.trim()) {
						handleSendMessage(e.currentTarget.value);
						e.currentTarget.value = "";
					}
				}}
				disabled={!selectedRoom && !selectedDirectChat}
			/>
		</div>
	);
}