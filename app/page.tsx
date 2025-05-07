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
			<div className="max-w-3xl mx-auto h-screen">
				<LoginLogoutButton user={data.session?.user} />
				<div className="h-full border rounded-md flex flex-col relative">
					<ChatHeader user={data.session?.user} />
					<ClientChatContent user={data.session?.user} />
				</div>
			</div>
			<InitUser user={data.session?.user} />
		</>
	);
}