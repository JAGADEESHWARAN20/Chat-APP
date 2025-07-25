import React from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ClientChatContent from "@/components/ClientChatContent";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Page() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getSession();

  return (
    <div className="min-h-[90vh] flex flex-col overflow-hidden">
      {/* Header section with fixed height */}
<div className="px-4 py-2  flex items-center"> {/* Added h-16 and flex items-center */}
  <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-bold">FlyChat</h1>
          </div>
          <div>
    <ThemeToggle />
    <LoginLogoutButton user={data.session?.user} />
          </div>
  </div>
</div>

      {/* Main content area that takes remaining height */}
      <div className=" flex flex-col w-[100vw] overflow-hidden">
        <div className="lg:max-w-[100vw]  w-[95vw] mx-auto px-4 flex flex-col flex-1">
          <div className="relative flex flex-col items-center flex-1">
            <ChatHeader user={data.session?.user} />
            <div className="flex-1 flex-row flex w-[100vw] lg:justify-evenly lg:gap-[5em] gradient-border overflow-hidden"> {/* Changed this line */}
              <div className="hidden lg:block">hi</div>
              <ClientChatContent user={data.session?.user} />
             <div className="hidden lg:block">hi</div>
            </div>
          </div>
        </div>
      </div>
      
      <InitUser user={data.session?.user} />
    </div>
  );
}