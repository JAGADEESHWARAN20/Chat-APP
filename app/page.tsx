import React from "react";
import ChatHeader from "@/components/ChatHeader";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/store/InitUser";
import ClientChatContent from "@/components/ClientChatContent";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import Image from "next/image";

export default async function Page() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getSession();

  return (
    <div className="min-h-[90vh] flex flex-col overflow-hidden">
      {/* Header section with fixed height */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">FlyChat</h1>
          </div>
          <LoginLogoutButton user={data.session?.user} />
        </div>
      </div>

      {/* Main content area that takes remaining height */}
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        <div className="max-w-7xl w-full mx-auto px-4 flex flex-col flex-1">
          <div className="relative flex flex-col flex-1">
            <ChatHeader user={data.session?.user} />
            <div className="flex-1 gradient-border overflow-hidden"> {/* Changed this line */}
              <ClientChatContent user={data.session?.user} />
            </div>
          </div>
        </div>
      </div>
      
      <InitUser user={data.session?.user} />
    </div>
  );
}