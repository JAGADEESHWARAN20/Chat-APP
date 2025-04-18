"use client";
import React, { Suspense } from "react";
import ListMessages from "./ListMessages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { LIMIT_MESSAGE } from "@/lib/constant";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useMessage } from "@/lib/store/messages";
import { toast } from "sonner";
import { useEffect } from "react";

export default function ChatMessages() {
	const supabase = supabaseBrowser();
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
	const setMessages = useMessage((state) => state.setMesssages);

	useEffect(() => {
		const fetchMessages = async () => {
			try {
				if (selectedRoom) {
					// Fetch room messages
					const { data, error } = await supabase
						.from("messages")
						.select("*, users(*)")
						.eq("room_id", selectedRoom.id)
						.range(0, LIMIT_MESSAGE)
						.order("created_at", { ascending: false });

					if (error) throw error;

					const formattedMessages = data?.reverse().map(msg => ({
						...msg,
						users: msg.users || null
					})) || [];

					setMessages(formattedMessages);
				} else if (selectedDirectChat) {
					// Fetch direct messages
					const { data, error } = await supabase
						.from("messages")
						.select("*, users(*)")
						.eq("direct_chat_id", selectedDirectChat.id)
						.range(0, LIMIT_MESSAGE)
						.order("created_at", { ascending: false });

					if (error) throw error;

					const formattedMessages = data?.reverse().map(msg => ({
						...msg,
						users: msg.users || null
					})) || [];

					setMessages(formattedMessages);
				}
			} catch (error) {
				toast.error('Failed to fetch messages');
				console.error('Error fetching messages:', error);
			}
		};

		fetchMessages();
	}, [selectedRoom, selectedDirectChat, setMessages, supabase]);

	return (
		<Suspense fallback={"loading.."}>
			<ListMessages />
		</Suspense>
	);
}