
import React from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import NavigationHeader from "@/components/NavigationHeader";

export default async function Page() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header section */}
      <header className="px-4 py-3 border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FlyChat</h1>
            <NavigationHeader user={user} />
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LoginLogoutButton user={user} />
          </div>
        </div>
      </header>

      {/* Main content area - centered chat interface */}
      <main className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-4xl flex flex-col h-[calc(100vh-80px)]">
          <ChatHeader user={user} />        
          <ChatMessages />
          <ChatInput />
        </div>
      </main>


      <InitUser user={user} />
    </div>
  );
}
