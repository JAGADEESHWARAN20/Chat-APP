import React from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ClientChatContent from "@/components/ClientChatContent";
import LoginLogoutButton from "@/components/LoginLogoutButton";

export default async function Page() {
	const supabase = supabaseServer();
	const { data } = await supabase.auth.getSession();

	return (
		<>
			<div className="h-screen px-2 py-1">
				<LoginLogoutButton user={data.session?.user} />
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