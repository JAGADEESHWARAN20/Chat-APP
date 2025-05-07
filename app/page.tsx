import React from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ClientChatContent from "@/components/ClientChatContent";

export default async function Page() {
	const supabase = supabaseServer();
	const { data } = await supabase.auth.getSession();

	return (
		<>
			<div className="max-w-3xl mx-auto md:py-10 h-screen">
					<ChatHeader user={data.session?.user} />
				<div className="h-full border rounded-md flex flex-col relative">
					<ClientChatContent user={data.session?.user} />
				</div>
			</div>
			<InitUser user={data.session?.user} />
		</>
	);
}