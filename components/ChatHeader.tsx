"use client";
import React, { useState, useEffect } from "react";
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

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
	const [users, setUsers] = useState<UserProfile[]>([]);
	const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
	const supabase = supabaseBrowser();
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [newRoomName, setNewRoomName] = useState("");
	const [isPrivate, setIsPrivate] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

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
					is_private: isPrivate
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to create room");
			}

			toast.success("Room created successfully!");
			setNewRoomName("");
			setIsPrivate(false);
			setIsDialogOpen(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create room");
		} finally {
			setIsCreating(false);
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

	const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchQuery(event.target.value);
	};

	const fetchUsers = async () => {
		const { data, error } = await supabase
			.from("users")
			.select("id, avatar_url, username, display_name, created_at");

		if (error) {
			console.error("Error fetching users:", error);
		} else if (data) {
			setUsers(data);
		}
	};

	useEffect(() => {
		if (searchType === "users") {
			fetchUsers();
		} else {
			setUsers([]);
			setSearchResults([]);
		}
	}, [searchType, supabase]);

	useEffect(() => {
		if (searchType === "users" && users.length > 0) {
			const filteredResults = users.filter((user) =>
				user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
			);
			setSearchResults(filteredResults);
		} else if (searchType === "rooms") {
			setSearchResults([]);
		} else {
			setSearchResults([]);
		}
	}, [searchQuery, searchType, users]);

	const handleSearchByType = (type: "rooms" | "users") => {
		setSearchType(type);
		setSearchQuery("");
	};

	return (
		<div className="h-20">
			<div className="p-5 border-b flex items-center justify-between h-full">
				<div>
					<h1 className="text-xl font-bold">Daily Chat</h1>
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
									<Button
										variant="outline"
										onClick={() => setIsDialogOpen(false)}
										disabled={isCreating}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreateRoom}
										disabled={isCreating}
									>
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
									placeholder="Search users..."
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
								{searchType === "users" && searchResults.length > 0 && (
									<div className="mt-4">
										<h4 className="font-semibold text-sm mb-2">User Profiles</h4>
										<ul className="space-y-2">
											{searchResults.map((userProfile) => (
												<li
													key={userProfile.id}
													className="flex items-center justify-between"
												>
													<div className="flex items-center gap-2">
														<Avatar>
															{userProfile.avatar_url ? (
																<AvatarImage src={userProfile.avatar_url} alt={userProfile.username || "Avatar"} />
															) : (
																<AvatarFallback>{userProfile.username?.charAt(0).toUpperCase() || userProfile.display_name?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
															)}
														</Avatar>
														<div>
															<div className="text-xs text-gray-500">{userProfile.username}</div>
															<div className="text-sm font-semibold">{userProfile.display_name}</div>
														</div>
													</div>
													<UserIcon className="h-4 w-4 text-gray-500" />
												</li>
											))}
										</ul>
									</div>
								)}
								{searchType === "users" && users.length > 0 && searchResults.length === 0 && searchQuery.length > 0 && (
									<p className="text-sm text-muted-foreground mt-2">No users found matching your search.</p>
								)}
								{searchType === "users" && users.length === 0 && (
									<p className="text-sm text-muted-foreground mt-2">Loading users...</p>
								)}
								{searchType === "rooms" && (
									<p className="text-sm text-muted-foreground mt-2">Room search functionality will be implemented here.</p>
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