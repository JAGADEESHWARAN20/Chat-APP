"use client";

import React from "react";
import { Input } from "./ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "@/lib/store/user";
import { Imessage, useMessage } from "@/lib/store/messages";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";

export default function ChatInput() {
	const user = useUser((state) => state.user);
	const addMessage = useMessage((state) => state.addMessage);
	const setOptimisticIds = useMessage((state) => state.setOptimisticIds);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
	const supabase = supabaseBrowser();

	const handleSendMessage = async (text: string) => {
		if (!text.trim() || !user) {
			toast.error("Please log in and enter a message");
			return;
		}
		if (!selectedRoom && !selectedDirectChat) {
			toast.error("Please select a room or user to chat with");
			return;
		}

		const id = uuidv4();
		const roomId = selectedRoom?.id;
		const directChatId = selectedDirectChat?.id;

		if (roomId && !selectedRoom) {
			toast.error("Room selection is invalid");
			return;
		}
		if (directChatId && !selectedDirectChat) {
			toast.error("Direct chat selection is invalid");
			return;
		}

		const newMessage: Imessage = {
			id,
			text,
			sender_id: user.id,
			room_id: roomId || null,
			direct_chat_id: directChatId || null,
			is_edited: false,
			dm_thread_id: null, 
			created_at: new Date().toISOString(),
			status: "sent",
			users: {
				id: user.id,
				avatar_url: user.user_metadata.avatar_url || "",
				created_at: new Date().toISOString(),
				display_name: user.user_metadata.user_name || "",
				username: user.user_metadata.user_name || "",
			},
		};

		// Optimistic update
		addMessage(newMessage);
		setOptimisticIds(id);

		try {
			const { error } = await supabase
				.from("messages")
				.insert({
					id,
					text,
					room_id: roomId,
					direct_chat_id: directChatId,
					sender_id: user.id,
					created_at: new Date().toISOString(),
					status: "sent",
				});

			if (error) {
				console.error("Supabase error:", error);
				throw error;
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error("Error sending message:", error);
				toast.error(`Failed to send message: ${error.message}`);
			} else {
				console.error("Unknown error sending message:", error);
				toast.error("Failed to send message due to an unknown error");
			}
			useMessage.getState().optimisticDeleteMessage(id);
			return;
		}
	};

	return (
		<div className="p-[1vw] gradient-border" style={{ borderRadius: '1vw', background: 'rgba(30,30,60,0.5)', backdropFilter: 'blur(1em)' }}>
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
				className="text-[1em] px-[1vw] py-[0.5em] rounded-[0.5em] glass-button"
			/>
		</div>
	);
}