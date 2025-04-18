"use client";
import React, { Suspense, useEffect } from "react";
import ListMessages from "./ListMessages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import InitMessages from "@/lib/store/InitMessages";
import { LIMIT_MESSAGE } from "@/lib/constant";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useMessage } from "@/lib/store/messages";

export default function ChatMessages() {
	const supabase = supabaseBrowser();
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const selectedDirectChat = useDirectChatStore((state) => state.selectedChat);
	const setMessages = useMessage((state) => state.setMesssages);

	useEffect(() => {
		const fetchMessages = async () => {
			if (selectedRoom) {
				// Fetch room messages
				const { data } = await supabase
					.from("messages")
					.select("*, users(*)")
					.eq("room_id", selectedRoom.id)
					.range(0, LIMIT_MESSAGE)
					.order("created_at", { ascending: false });

				setMessages(data?.reverse() || []);
			} else if (selectedDirectChat) {
				// Fetch direct messages
				const { data } = await supabase
					.from("messages")
					.select("*, users(*)")
					.eq("direct_chat_id", selectedDirectChat.id)
					.range(0, LIMIT_MESSAGE)
					.order("created_at", { ascending: false });

				setMessages(data?.reverse() || []);
			}
		};

		fetchMessages();
	}, [selectedRoom, selectedDirectChat, setMessages]);

	return (
		<Suspense fallback={"loading.."}>
			<ListMessages />
		</Suspense>
	);
}