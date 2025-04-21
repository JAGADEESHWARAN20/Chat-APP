"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ChatPresence from "./ChatPresence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, User as UserIcon, Settings, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Database } from "@/lib/types/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDebounce } from "use-debounce";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type SearchResult = UserProfile | Room;

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const supabase = supabaseBrowser();
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [newRoomName, setNewRoomName] = useState("");
	const [isPrivate, setIsPrivate] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const selectedRoom = useRoomStore((state) => state.selectedRoom);
	const isMounted = useRef(true); // Moved to top level
	const [isLoading, setIsLoading] = useState(false);

	const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
	
	
	
	// Debounce the search input change handler
	const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
	
	const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		debouncedCallback(e.target.value);
		setSearchQuery(e.target.value);
	};

	const fetchSearchResults = useCallback(async () => {
		// Do not search if query is empty or searchType is not selected
		if (!debouncedSearchQuery.trim() || !searchType) {
			setSearchResults([]);
			setIsLoading(false); // Ensure loading is off when clearing results or no type selected
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch(`/api/${searchType}/search?query=${encodeURIComponent(debouncedSearchQuery)}`);
			const data = await response.json();

			// Only update state if component is mounted
			if (isMounted.current) {
				if (response.ok) {
					let results: SearchResult[] = [];
					if (searchType === "users") {
						// Assuming /api/users/search returns the array directly
						results = Array.isArray(data) ? (data as UserProfile[]) : [];
					} else if (searchType === "rooms") {
						// Assuming /api/rooms/search returns { rooms: [...], total: ..., ... }
						results = data.rooms && Array.isArray(data.rooms) ? (data.rooms as Room[]) : [];
					}
					setSearchResults(results);
				} else {
					// Handle API errors
					toast.error(data.error || `Failed to search ${searchType}`);
					setSearchResults([]);
				}
			}
		} catch (error) {
			console.error("Search error:", error); // Log the actual error for debugging
			if (isMounted.current) {
				toast.error("An error occurred while searching");
				setSearchResults([]);
			}
		} finally {
			if (isMounted.current) {
				setIsLoading(false);
			}
		}
	}, [debouncedSearchQuery, searchType]); // Dependencies for useCallback updated to debouncedQuery

	// Trigger search whenever the debounced query or search type changes
	useEffect(() => {
		fetchSearchResults();
	}, [debouncedSearchQuery, searchType, fetchSearchResults]);

	// Effect to clean up the mounted ref
	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []); // Runs only on unmount

	useEffect(() => {
		const channel = supabase
			.channel("rooms")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "rooms" },
				(payload) => {
					if (isMounted.current && payload.new) useRoomStore.getState().setRooms(Array.isArray(payload.new) ? payload.new : [payload.new]);
				}
			)
			.subscribe((status) => {
				console.log("Subscription status:", status);
				if (status === "CLOSED") toast.error("Room subscription closed");
			});

		return () => {
			isMounted.current = false;
			supabase.removeChannel(channel);
		};
	}, [supabase]); // Added supabase to dependencies

	const handleCreateRoom = async () => {
		if (!user) {
			toast.error("You must be logged in to create a room");
			return;
		}

		if (!newRoomName.trim()) {
			toast.error("Room name cannot be empty");
			return;
		}

		setIsCreating(true);

		try {
			const response = await fetch("/api/rooms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newRoomName.trim(),
					is_private: isPrivate,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to create room");
			}

			if (isMounted.current) {
				const { data: newRooms } = await supabase.from("rooms").select("*");
				useRoomStore.getState().setRooms(newRooms || []);
				toast.success("Room created successfully!");
				setNewRoomName("");
				setIsPrivate(false);
				setIsDialogOpen(false);
			}
		} catch (error) {
			if (isMounted.current) {
				toast.error(error instanceof Error ? error.message : "Failed to create room");
			}
		} finally {
			if (isMounted.current) {
				setIsCreating(false);
			}
		}
	};

	const handleLoginWithGithub = () => {
		supabase.auth.signInWithOAuth({
			provider: "github",
			options: {
				redirectTo: location.origin + "/auth/callback",
			},
		});
	};

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.refresh();
	};

	const handleSearchByType = (type: "rooms" | "users") => {
		setSearchType(type);
		setSearchQuery("");
	};

	const handleJoinRoom = (roomId: string) => {
		if (!user) {
			toast.error("You must be logged in to join a room");
			return;
		}
		// Log the values before posting
		console.log("Posting to /join with values:", {
			roomId: roomId,
			userId: user ? user.id : "Not logged in",
			requestBody: {}, // No body is currently sent
		});

		fetch(`/api/rooms/${roomId}/join`, { method: "POST" })
			.then((response) => {
				if (!response.ok) throw new Error("Failed to join room");
				return response.json();
			})
			.then((data) => {
				toast.success(data.status === "pending" ? "Join request sent" : "Joined room successfully");
			})
			.catch((error) => {
				toast.error(error.message || "Failed to join room");
			});
	};

	return (
		<div className="h-20">
			<div className="p-5 border-b flex items-center justify-between h-full">
				<div>
					<h1 className="text-xl font-bold">{selectedRoom ? selectedRoom.name : "Daily Chat"}</h1>
					<ChatPresence />
				</div>

				<div className="flex items-center gap-2">
					{user && (
						<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="outline" size="icon">
									<PlusCircle className="h-4 w-4" />
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create New Room</DialogTitle>
									<DialogDescription>
										Create a new chat room. Private rooms require approval to join.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="space-y-2">
										<Label htmlFor="roomName">Room Name</Label>
										<Input
											id="roomName"
											placeholder="Enter room name"
											value={newRoomName}
											onChange={(e) => setNewRoomName(e.target.value)}
											disabled={isCreating}
										/>
									</div>
									<div className="flex items-center space-x-2">
										<Switch
											id="private"
											checked={isPrivate}
											onCheckedChange={setIsPrivate}
											disabled={isCreating}
										/>
										<Label htmlFor="private">Private Room</Label>
									</div>
								</div>
								<DialogFooter>
									<Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
										Cancel
									</Button>
									<Button onClick={handleCreateRoom} disabled={isCreating}>
										{isCreating ? "Creating..." : "Create Room"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					)}

					<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="icon">
								<Search className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="p-4">
								<div className="flex justify-end mb-2">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => {
											setIsPopoverOpen(false);
											router.push("/profile");
										}}
									>
										<Settings className="h-4 w-4" />
									</Button>
								</div>
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
										<h4 className="font-semibold text-sm mb-2">
											{searchType === "users" ? "User Profiles" : "Rooms"}
										</h4>
										<ul className="space-y-2">
											{searchResults.map((result) =>
												"username" in result ? (
													<li key={result.id} className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<Avatar>
																{result.avatar_url ? (
																	<AvatarImage
																		src={result.avatar_url}
																		alt={result.username || "Avatar"}
																	/>
																) : (
																	<AvatarFallback>
																		{result.username?.charAt(0).toUpperCase() ||
																			result.display_name?.charAt(0).toUpperCase() ||
																			"?"}
																	</AvatarFallback>
																)}
															</Avatar>
															<div>
																<div className="text-xs text-gray-500">{result.username}</div>
																<div className="text-sm font-semibold">{result.display_name}</div>
															</div>
														</div>
														<UserIcon className="h-4 w-4 text-gray-500" />
													</li>
												) : (
													<li key={result.id} className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<span className="text-sm font-semibold">
																{result.name} {result.is_private && "🔒"}
															</span>
														</div>
														<Button
															size="sm"
															onClick={() => handleJoinRoom(result.id)}
															disabled={!user}
														>
															Join
														</Button>
													</li>
												)
											)}
										</ul>
									</div>
								)}
								{searchResults.length === 0 && searchQuery.length > 0 && (
									<p className="text-sm text-muted-foreground mt-2">
										No {searchType || "results"} found matching your search.
									</p>
								)}
								{searchQuery.length === 0 && searchType && (
									<p className="text-sm text-muted-foreground mt-2">Start typing to search...</p>
								)}
								{isLoading && <p className="text-sm text-muted-foreground mt-2">Loading...</p>}
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