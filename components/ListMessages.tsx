"use client";
import { Imessage, useMessage } from "@/lib/store/messages";
import React, { useEffect, useRef, useState } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import LoadMoreMessages from "./LoadMoreMessages";
import { Database } from "@/lib/types/supabase";
import { useRoomStore } from '@/lib/store/roomstore';
import { LIMIT_MESSAGE } from "@/lib/constant";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default function ListMessages() {
	const scrollRef = useRef() as React.MutableRefObject<HTMLDivElement>;
	const [userScrolled, setUserScrolled] = useState(false);
	const [notification, setNotification] = useState(0);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const {
		messages,
		setMesssages,
		addMessage,
		optimisticIds,
		optimisticDeleteMessage,
		optimisticUpdateMessage,
	} = useMessage((state) => state);
	const supabase = supabaseBrowser();

	// Add the missing handleOnScroll function
	const handleOnScroll = () => {
		const scrollContainer = scrollRef.current;
		if (scrollContainer) {
			const isScroll =
				scrollContainer.scrollTop <
				scrollContainer.scrollHeight -
				scrollContainer.clientHeight -
				10;
			setUserScrolled(isScroll);
			if (
				scrollContainer.scrollTop ===
				scrollContainer.scrollHeight - scrollContainer.clientHeight
			) {
				setNotification(0);
			}
		}
	};

	// Add the missing scrollDown function
	const scrollDown = () => {
		setNotification(0);
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	};

	// Initial messages load
	useEffect(() => {
		if (!selectedRoom) return;

		const loadInitialMessages = async () => {
			const { data: messagesData, error } = await supabase
				.from("messages")
				.select(`
                    *,
                    users (
                        id,
                        username,
                        avatar_url,
                        display_name,
                        created_at
                    )
                `)
				.eq('room_id', selectedRoom.id)
				.order('created_at', { ascending: false })
				.limit(LIMIT_MESSAGE);

			if (error) {
				toast.error('Failed to load messages');
				return;
			}

			if (messagesData) {
				const formattedMessages: Imessage[] = messagesData.reverse().map(msg => ({
					id: msg.id,
					created_at: msg.created_at,
					is_edit: msg.is_edit,
					send_by: msg.send_by,
					text: msg.text,
					room_id: msg.room_id,
					users: msg.users ? {
						id: msg.users.id,
						avatar_url: msg.users.avatar_url || '',
						display_name: msg.users.display_name || '',
						username: msg.users.username || '',
						created_at: msg.users.created_at
					} : null
				}));

				setMesssages(formattedMessages);
				setIsInitialLoad(false);
			}
		};

		loadInitialMessages();
	}, [selectedRoom, supabase, setMesssages]);

	// Real-time subscription
	useEffect(() => {
		if (!selectedRoom) return;

		const channel = supabase
			.channel(`room:${selectedRoom.id}`)
			.on('postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'messages',
					filter: `room_id=eq.${selectedRoom.id}`
				},
				async (payload) => {
					if (payload.eventType === 'INSERT') {
						const newMessagePayload = payload.new as MessageRow;
						if (!optimisticIds.includes(newMessagePayload.id)) {
							const { data: user, error } = await supabase
								.from("users")
								.select("*")
								.eq("id", newMessagePayload.send_by)
								.single<UserRow>();

							if (error) {
								toast.error(error.message);
								return;
							}

							if (user) {
								const newMessage: Imessage = {
									id: newMessagePayload.id,
									created_at: newMessagePayload.created_at,
									is_edit: newMessagePayload.is_edit,
									send_by: newMessagePayload.send_by,
									room_id: newMessagePayload.room_id,
									text: newMessagePayload.text,
									users: {
										id: user.id,
										avatar_url: user.avatar_url || '',
										display_name: user.display_name || '',
										username: user.username || '',
										created_at: user.created_at
									}
								};
								addMessage(newMessage);

								const scrollContainer = scrollRef.current;
								if (
									scrollContainer.scrollTop <
									scrollContainer.scrollHeight -
									scrollContainer.clientHeight -
									10
								) {
									setNotification((current) => current + 1);
								}
							}
						}
					}
				})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [selectedRoom, optimisticIds, addMessage, supabase]);

	// Scroll effect
	useEffect(() => {
		const scrollContainer = scrollRef.current;
		if (scrollContainer && !userScrolled) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
		}
	}, [messages, userScrolled]);

	return (
		<>
			<div
				className="flex-1 flex flex-col p-5 h-full overflow-y-auto"
				ref={scrollRef}
				onScroll={handleOnScroll}
			>
				{isInitialLoad ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
					</div>
				) : (
					<>
						<div className="flex-1 pb-5">
							<LoadMoreMessages />
						</div>
						<div className="space-y-7">
							{messages.map((value) => (
								<Message key={value.id} message={value} />
							))}
						</div>
					</>
				)}

				<DeleteAlert />
				<EditAlert />
			</div>
			{userScrolled && (
				<div className="absolute bottom-20 w-full">
					{notification ? (
						<div
							className="w-36 mx-auto bg-indigo-500 p-1 rounded-md cursor-pointer"
							onClick={scrollDown}
						>
							<h1>New {notification} messages</h1>
						</div>
					) : (
						<div
							className="w-10 h-10 bg-blue-500 rounded-full justify-center items-center flex mx-auto border cursor-pointer hover:scale-110 transition-all"
							onClick={scrollDown}
						>
							<ArrowDown />
						</div>
					)}
				</div>
			)}
		</>
	);
}