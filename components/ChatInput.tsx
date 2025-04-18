"use client";
import React from "react";
import { Input } from "./ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "@/lib/store/user";
import { Imessage, useMessage } from "@/lib/store/messages";
import { useRoomStore } from '@/lib/store/roomstore';

export default function ChatInput() {
	const user = useUser((state) => state.user);
	const addMessage = useMessage((state) => state.addMessage);
	const setOptimisticIds = useMessage((state) => state.setOptimisticIds);
	const supabase = supabaseBrowser();
	const selectedRoom = useRoomStore((state) => state.selectedRoom);

	const handleSendMessage = async (text: string) => {
		if (!text.trim() || !user || !selectedRoom) return;

		const id = uuidv4();
		const newMessage = {
			id,
			text,
			send_by: user.id,
			room_id: selectedRoom.id,
			is_edit: false,
			created_at: new Date().toISOString(),
			users: {
				id: user.id,
				avatar_url: user.user_metadata.avatar_url || "",
				created_at: new Date().toISOString(),
				display_name: user.user_metadata.user_name || "",
				username: user.user_metadata.user_name || "", // Add the missing username field
			},
		};

		try {
			const { error } = await supabase
				.from("messages")
				.insert({
					text,
					id,
					room_id: selectedRoom.id,
					send_by: user.id
				});

			if (error) throw error;

			addMessage(newMessage as Imessage);
			setOptimisticIds(id); // Add this line back to maintain optimistic updates
		} catch (error) {
			toast.error("Failed to send message");
		}
	};

	return (
		<div className="p-5">
			<Input
				placeholder="send message"
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						handleSendMessage(e.currentTarget.value);
						e.currentTarget.value = "";
					}
				}}
			/>
		</div>
	);
}