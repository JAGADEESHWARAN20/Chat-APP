"use client";
import { useUser } from "@/lib/store/user";
import { supabaseBrowser } from "@/lib/supabase/browser";
import React, { useEffect, useState } from "react";


export default function ChatPresence() {
	const user = useUser((state) => state.user);
	const supabase = supabaseBrowser();
	const [onlineUsers, setOnlineUsers] = useState(0);

	useEffect(() => {
		if (!user?.id) return;

		const channel = supabase.channel("roomx");
		channel
			.on("presence", { event: "sync" }, () => {
				const userIds = Object.values(channel.presenceState())
					.flatMap((presence) =>
						presence.map((p) => (p as unknown as { user_id: string }).user_id)
					)
					.filter((id): id is string => id !== undefined);
				setOnlineUsers(new Set(userIds).size);
			})
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED") {
					await channel.track({
						online_at: new Date().toISOString(),
						user_id: user.id,
					});
				} else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
					console.error("Presence channel error, attempting to resubscribe...");
					channel.unsubscribe();
					setTimeout(() => channel.subscribe(), 1000);
				}
			});

		return () => {
			channel.unsubscribe();
		};
	}, [user?.id]);

	if (!user) {
		return <div className="h-3 w-1"></div>;
	}

	return (
		<div className="flex items-center gap-1">
			<div className="h-4 w-4 bg-green-500 rounded-full animate-pulse"></div>
			<h1 className="text-sm text-gray-400">{onlineUsers} onlines</h1>
		</div>
	);
}