"use client";
import { Imessage, useMessage } from "@/lib/store/messages"; // Make sure this Imessage definition aligns with the structure below
import React, { useEffect, useRef, useState } from "react";
import Message from "./Message";
import { DeleteAlert, EditAlert } from "./MessasgeActions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import LoadMoreMessages from "./LoadMoreMessages";
import { Database } from "@/lib/types/supabase"; // Import Database type
import { useRoomStore } from '@/lib/store/roomstore';

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default function ListMessages() {
	const scrollRef = useRef() as React.MutableRefObject<HTMLDivElement>;
	const [userScrolled, setUserScrolled] = useState(false);
	const [notification, setNotification] = useState(0);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	

	useEffect(() => {
		if (!selectedRoom) return;

		// Subscribe to messages for the selected room
		const channel = supabase
			.channel(`room:${selectedRoom.id}`)
			.on('postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'messages',
					filter: `room_id=eq.${selectedRoom.id}`
				},
				(payload) => {
					// Handle message updates
				})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [selectedRoom]);

	const {
		messages,
		addMessage,
		optimisticIds,
		optimisticDeleteMessage,
		optimisticUpdateMessage,
	} = useMessage((state) => state);

	const supabase = supabaseBrowser();
	useEffect(() => {
		const channel = supabase
			.channel("chat-room")
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "messages" },
				async (payload) => {
					const newMessagePayload = payload.new as MessageRow;
					if (!optimisticIds.includes(newMessagePayload.id)) {
						const { error, data: user } = await supabase
							.from("users")
							.select("*")
							.eq("id", newMessagePayload.send_by)
							.single<UserRow>();

						if (error) {
							toast.error(error.message);
						} else if (user) {
							const newMessage: Imessage = {
								id: newMessagePayload.id,
								created_at: newMessagePayload.created_at,
								is_edit: newMessagePayload.is_edit,
								send_by: newMessagePayload.send_by,
								text: newMessagePayload.text,
								users: { // Assuming 'Imessage' expects a nested 'users' object
									avatar_url: user.avatar_url,
									display_name: user.display_name,
									username: user.username,
									id: user.id, // Include user ID if needed in Imessage
									created_at: user.created_at, // Include user creation time if needed
								},
							};
							addMessage(newMessage);
						}
					}
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
			)
			.on(
				"postgres_changes",
				{ event: "DELETE", schema: "public", table: "messages" },
				(payload) => {
					optimisticDeleteMessage(payload.old.id);
				}
			)
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "messages" },
				(payload) => {
					optimisticUpdateMessage(payload.new as Imessage);
				}
			)
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [messages, optimisticIds, addMessage, optimisticDeleteMessage, optimisticUpdateMessage, supabase]); // Added missing dependencies

	useEffect(() => {
		const scrollContainer = scrollRef.current;
		if (scrollContainer && !userScrolled) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
		}
	}, [messages, userScrolled]);

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
	const scrollDown = () => {
		setNotification(0);
		scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	};

	return (
		<>
			<div
				className="flex-1 flex flex-col p-5 h-full overflow-y-auto"
				ref={scrollRef}
				onScroll={handleOnScroll}
			>
				<div className="flex-1 pb-5 ">
					<LoadMoreMessages />
				</div>
				<div className=" space-y-7">
					{messages.map((value, index) => {
						return <Message key={index} message={value} />;
					})}
				</div>

				<DeleteAlert />
				<EditAlert />
			</div>
			{userScrolled && (
				<div className=" absolute bottom-20 w-full">
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