import React, { Suspense } from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ClientChatContent from "@/components/ClientChatContent";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Page() {
	const supabase = supabaseServer();
	const { data } = await supabase.auth.getSession();

	return (
		<Suspense fallback={<Skeleton className="w-full h-screen bg-gray-900" />}>
			<div className="flex h-screen bg-gray-900 text-white">
				<ChatHeader user={data.session?.user} />
				<div className="flex-1 flex flex-col">
					<ClientChatContent user={data.session?.user} />
				</div>
				<InitUser user={data.session?.user} />
			</div>
		</Suspense>
	);
}