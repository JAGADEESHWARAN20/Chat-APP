import React from "react";

import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/initialization/InitUser";

import LoginLogoutButton from "@/components/LoginLogoutButton";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import { RoomProvider } from "@/lib/store/RoomContext";
import ChatLayout from "@/components/ChatLayout"; // New client component for interactivity

export default async function Page() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getSession();

  return (
    <RoomProvider user={data.session?.user}>
      <div className="min-h-[90vh] flex flex-col overflow-hidden">
        {/* Header section with full width */}
        <header className="w-full px-6 py-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 glass-gradient-header">
          <div className="flex items-center justify-between max-w-[100vw] mx-auto w-full">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
                FlyChat
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <SearchComponent user={data.session?.user} />
              <CreateRoomDialog user={data.session?.user} />
              <NotificationsWrapper />
              <LoginLogoutButton user={data.session?.user} />
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 w-full overflow-hidden">
          <ChatLayout user={data.session?.user} />
        </div>

        <InitUser user={data.session?.user} />
      </div>
    </RoomProvider>
  );
}