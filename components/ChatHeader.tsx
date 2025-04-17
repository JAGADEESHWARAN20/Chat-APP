"use client";
import React, { useState } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ChatPresence from "./ChatPresence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ChatHeader({ user }: { user: User | undefined }) {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
	const [searchResults, setSearchResults] = useState<string[]>([]); // Placeholder for search results

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

	const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchQuery(event.target.value);
		// In a real application, you might trigger a search here or after a certain delay
	};

	const handleSearchByType = (type: "rooms" | "users") => {
		setSearchType(type);
		// In a real application, you would trigger a fetch based on the searchType and searchQuery
		// For now, let's just update the search results for UI demonstration
		if (type === "rooms") {
			setSearchResults(["Room 1", "Room 2", "General Room"]);
		} else if (type === "users") {
			setSearchResults(["User A", "User B", "Online User"]);
		}
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
							<div className="p-4">
								<h3 className="font-semibold text-lg mb-2">Search</h3>
								<Input
									type="text"
									placeholder="Search..."
									value={searchQuery}
									onChange={handleSearchInputChange}
									className="mb-4"
								/>
								<div className="flex gap-2 mb-4">
									<Button
										variant={searchType === "rooms" ? "default" : "outline"}
										onClick={() => handleSearchByType("rooms")}
									>
										Rooms
									</Button>
									<Button
										variant={searchType === "users" ? "default" : "outline"}
										onClick={() => handleSearchByType("users")}
									>
										Users
									</Button>
								</div>
								{searchResults.length > 0 && (
									<div className="mt-4">
										<h4 className="font-semibold text-sm mb-2">Results</h4>
										<ul className="space-y-2">
											{searchResults.map((result, index) => (
												<li key={index} className="text-sm text-gray-600">{result}</li>
											))}
										</ul>
									</div>
								)}
								{searchType && searchResults.length === 0 && (
									<p className="text-sm text-muted-foreground mt-2">No results found.</p>
								)}
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