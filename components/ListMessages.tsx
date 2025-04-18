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
	const scrollRef = useRef<HTMLDivElement>(null);
	const [userScrolled, setUserScrolled] = useState(false);
	const [notification, setNotification] = useState(0);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const {
		messages,
		setMessages,
		addMessage,
		optimisticIds,
		optimisticDeleteMessage,
		optimisticUpdateMessage,
	} = useMessage((state) => state);
	const supabase = supabaseBrowser();

	const handleOnScroll = () => {
		if (!scrollRef.current) return;
		const scrollContainer = scrollRef.current;
		const isScroll = scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight - 10;
		setUserScrolled(isScroll);
		if (scrollContainer.scrollTop === scrollContainer.scrollHeight - scrollContainer.clientHeight) {
			setNotification(0);
		}
	};

	const scrollDown = () => {
		setNotification(0);
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	};

	useEffect(() => {
		if (!selectedRoom) return;

		const loadInitialMessages = async () => {
			try {
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
						direct_chat_id: msg.direct_chat_id,
						dm_thread_id: msg.dm_thread_id,
						status: msg.status, // Now accepts string | null
						users: msg.users ? {
							id: msg.users.id,
							avatar_url: msg.users.avatar_url || '',
							display_name: msg.users.display_name || '',
							username: msg.users.username || '',
							created_at: msg.users.created_at
						} : null
					}));
					setMessages(formattedMessages);
					setIsInitialLoad(false);
				}
			} catch (err) {
				toast.error('Unexpected error loading messages');
				console.error(err);
			}
		};

		loadInitialMessages();
	}, [selectedRoom, supabase, setMessages]);

	useEffect(() => {
		if (!selectedRoom) return;

		const channel = supabase
			.channel(`room_messages_${selectedRoom.id}`)
			.on('postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'messages',
					filter: `room_id=eq.${selectedRoom.id}`
				},
				(payload) => {
					try {
						const messagePayload = payload.new as MessageRow;
						if (payload.eventType === 'INSERT' && !optimisticIds.includes(messagePayload.id)) {
							supabase.from("users")
								.select("*")
								.eq("id", messagePayload.send_by)
								.single<UserRow>()
								.then(({ data: user, error }) => {
									if (error) {
										toast.error(error.message);
										return;
									}
									if (user) {
										const newMessage: Imessage = {
											id: messagePayload.id,
											created_at: messagePayload.created_at,
											is_edit: messagePayload.is_edit,
											send_by: messagePayload.send_by,
											room_id: messagePayload.room_id,
											direct_chat_id: messagePayload.direct_chat_id,
											dm_thread_id: messagePayload.dm_thread_id,
											status: messagePayload.status, // Now accepts string | null
											text: messagePayload.text,
											users: {
												id: user.id,
												avatar_url: user.avatar_url || '',
												display_name: user.display_name || '',
												username: user.username || '',
												created_at: user.created_at
											}
										};
										addMessage(newMessage);

										if (scrollRef.current && scrollRef.current.scrollTop < scrollRef.current.scrollHeight - scrollRef.current.clientHeight - 10) {
											setNotification(prev => prev + 1);
										}
									}
								});
						} else if (payload.eventType === 'UPDATE') {
							const updatedMessage = payload.new as MessageRow;
							optimisticUpdateMessage(updatedMessage.id, {
								id: updatedMessage.id,
								text: updatedMessage.text,
								is_edit: updatedMessage.is_edit,
								created_at: updatedMessage.created_at,
								send_by: updatedMessage.send_by,
								room_id: updatedMessage.room_id,
								direct_chat_id: updatedMessage.direct_chat_id,
								dm_thread_id: updatedMessage.dm_thread_id,
								status: updatedMessage.status // Now accepts string | null
							});
						} else if (payload.eventType === 'DELETE') {
							optimisticDeleteMessage(payload.old.id);
						}
					} catch (err) {
						toast.error('Error processing real-time message update');
						console.error(err);
					}
				})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [selectedRoom, optimisticIds, addMessage, optimisticUpdateMessage, optimisticDeleteMessage, supabase]);

	useEffect(() => {
		if (scrollRef.current && !userScrolled) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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