"use client";
import React from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ChatPresence from "./ChatPresence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";

export default function ChatHeader({ user }: { user: User | undefined }) {
	const router = useRouter();

	const handleLoginWithGithub = () => {
		const supabase = supabaseBrowser();
		supabase.auth.signInWithOAuth({
			provider: "github",
			options: {
				redirectTo: location.origin + "/auth/callback",
			},
		});
	};

	const handleLogout = async () => {
		const supabase = supabaseBrowser();
		await supabase.auth.signOut();
		router.refresh();
	};

	return (
		<div className="h-20">
			<div className="p-5 border-b flex items-center justify-between h-full">
				<div>
					<h1 className="text-xl font-bold">Daily Chat</h1>
					<ChatPresence />
				</div>

				<div className="flex items-center gap-2">
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="icon">
								<Search className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<h3 className="font-semibold text-lg">Settings</h3>
							<p className="text-sm text-muted-foreground">
								Customize your chat experience.
							</p>
							<div className="grid gap-2 py-4">
								<div className="border rounded-md p-2">
									<p className="text-sm font-semibold">Theme</p>
									<div className="flex gap-2">
										<Button size="sm">Light</Button>
										<Button size="sm">Dark</Button>
									</div>
								</div>
								<div className="border rounded-md p-2">
									<p className="text-sm font-semibold">Notifications</p>
									<Button size="sm">Enable</Button>
								</div>
							</div>
						</PopoverContent>
					</Popover>

					{user ? (
						<Button onClick={handleLogout}>Logout</Button>
					) : (
						<Button onClick={handleLoginWithGithub}>Login</Button>
					)}
				</div>
			</div>
		</div>
	);
}