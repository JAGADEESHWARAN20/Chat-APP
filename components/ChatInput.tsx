"use client";
import React from "react";
import { Input } from "./ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "@/lib/store/user";
import { Imessage, useMessage } from "@/lib/store/messages";
import { useRoomStore } from '@/lib/store/roomstore';
import { useDirectChatStore } from '@/lib/store/directChatStore';

export default function ChatInput() {
	const user = useUser((state) => state.user);
	const addMessage = useMessage((state) => state.addMessage);
	const setOptimisticIds = useMessage((state) => state.setOptimisticIds);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
	const supabase = supabaseBrowser();

	const handleSendMessage = async (text: string) => {
		if (!text.trim() || !user) return;
		if (!selectedRoom && !selectedDirectChat) {
			toast.error("Please select a room or user to chat with");
			return;
		}

		const id = uuidv4();
		const newMessage: Imessage = {
			id,
			text,
			send_by: user.id,
			room_id: selectedRoom?.id || null,
			direct_chat_id: selectedDirectChat?.id || null,
			is_edit: false,
			created_at: new Date().toISOString(),
			status: null, // Added to satisfy Imessage interface
			users: {
				id: user.id,
				avatar_url: user.user_metadata.avatar_url || "",
				created_at: new Date().toISOString(),
				display_name: user.user_metadata.user_name || "",
				username: user.user_metadata.user_name || "",
			},
		};
		addMessage(newMessage); // Optimistic

		try {
			const { error } = await supabase
				.from("messages")
				.insert({
					text,
					id,
					room_id: selectedRoom?.id || null,
					direct_chat_id: selectedDirectChat?.id || null,
					send_by: user.id,
					status: null // Added to match database schema
				});

			if (error) throw error;

			addMessage(newMessage);
			setOptimisticIds(id);
		} catch (error) {
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
					if (e.key === "Enter") {
						handleSendMessage(e.currentTarget.value);
						e.currentTarget.value = "";
					}
				}}
				disabled={!selectedRoom && !selectedDirectChat}
			/>
		</div>
	);
}