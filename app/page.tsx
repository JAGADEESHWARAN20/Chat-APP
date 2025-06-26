import React from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ClientChatContent from "@/components/ClientChatContent";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import Image from "next/image"; // Add this import

export default async function Page() {
	const supabase = supabaseServer();
	const { data } = await supabase.auth.getSession();

	return (
		<>
			<div className="h-screen px-2 py-1">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h1 className="text-xl font-bold">FlyChat</h1>
					</div>
					<LoginLogoutButton user={data.session?.user} />
				</div>
				<div className="max-w-3xl mx-auto">
					<ChatHeader user={data.session?.user} />
					<div className="h-[85dvh] border rounded-md flex flex-col relative">
						<ClientChatContent user={data.session?.user} />
					</div>
				</div>
				<InitUser user={data.session?.user} />
			</div>
		</>
	);
}