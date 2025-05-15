import React, { useState } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { LIMIT_MESSAGE } from "@/lib/constant";
import { getFromAndTo } from "@/lib/utils";
import { useMessage } from "@/lib/store/messages";
import { toast } from "sonner";
import { useRoomStore } from "@/lib/store/roomstore";
import type { Imessage } from "@/lib/store/messages";

export default function LoadMoreMessages() {
	const page = useMessage((state) => state.page);
	const setMessages = useMessage((state) => state.setMessages);
	const hasMore = useMessage((state) => state.hasMore);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const [loading, setLoading] = useState(false);

	const fetchMore = async () => {
		if (!selectedRoom?.id) {
			toast.error("No room selected");
			return;
		}

		try {
			setLoading(true);
			const { from, to } = getFromAndTo(page, LIMIT_MESSAGE);
			const supabase = supabaseBrowser();

			console.log("[LoadMoreMessages] Fetching messages for room:", selectedRoom.id, { from, to });
			const { data, error } = await supabase
				.from("messages")
				.select("*, users(*)")
				.eq("room_id", selectedRoom.id)
				.range(from, to)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("[LoadMoreMessages] Supabase Query Error:", error);
				throw error;
			}

			console.log("[LoadMoreMessages] Messages fetched:", data);
			if (data && data.length > 0) {
				setMessages(data.reverse()); // Type assertion no longer needed
			} else {
				toast.info("No more messages to load.");
			}
		} catch (err: any) {
			console.error("[LoadMoreMessages] Error:", err);
			toast.error(err.message || "Failed to load messages");
		} finally {
			setLoading(false);
		}
	};

	if (!hasMore) return null;

	return (
		<Button
			variant="outline"
			className="w-full"
			onClick={fetchMore}
			disabled={loading}
		>
			{loading ? "Loading..." : "Load More"}
		</Button>
	);
}