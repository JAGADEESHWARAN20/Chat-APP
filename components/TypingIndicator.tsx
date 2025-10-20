"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTypingStatus } from "@/hooks/useTypingStatus";

interface TypingIndicatorProps {
  roomId: string;
  currentUserId?: string;
}

export default function TypingIndicator({
  roomId,
  currentUserId,
}: TypingIndicatorProps) {
  const supabase = supabaseBrowser();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const { typingUsers } = useTypingStatus(roomId, currentUserId || "");

  /** Unique typers (excluding current user) */
  const uniqueTypers = useMemo(
    () => [...new Set(typingUsers
      .filter(u => u.is_typing && u.user_id !== currentUserId)
      .map(u => u.user_id)
    )],
    [typingUsers, currentUserId]
  );

  /** Fetch user display names only when typers change */
  useEffect(() => {
    if (uniqueTypers.length === 0) {
      setUserNames({});
      return;
    }

    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", uniqueTypers);

      if (!active || error || !data) return;
      const nameMap = data.reduce((acc, u) => {
        acc[u.id] = u.display_name || u.username || "Someone";
        return acc;
      }, {} as Record<string, string>);
      setUserNames(nameMap);
    })();

    return () => { active = false };
  }, [uniqueTypers, supabase]);

  /** Resolve typing names */
  const typingNames = useMemo(
    () => uniqueTypers.map(id => userNames[id]).filter(Boolean),
    [uniqueTypers, userNames]
  );

  /** No one typing */
  if (typingNames.length === 0) return null;

  /** Build display string */
  const displayText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length === 2
      ? `${typingNames[0]} and ${typingNames[1]} are typing...`
      : `${typingNames.slice(0, -1).join(", ")}, and ${
          typingNames.at(-1)
        } are typing...`;

  return (
    <div
      className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium flex items-center z-50 relative"
      role="status"
      aria-live="polite"
    >
      <span className="animate-pulse flex items-center gap-2">
        <span className="inline-flex gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
        {displayText}
      </span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
