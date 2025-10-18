// components/DebuggingTyping.tsx - FIXED VERSION
"use client";

import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useState, useEffect } from "react";

export function DebugTypingStatus({ roomId, userId }: { roomId: string; userId: string }) {
  const { typingUsers, startTyping } = useTypingStatus(roomId, userId);
  const [manualTest, setManualTest] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>("");

  const testTyping = async () => {
    console.log("🧪 Manually triggering typing...");
    setLastEvent("Manual typing triggered");
    setManualTest(true);
    startTyping();
    
    // Auto reset after 3 seconds
    setTimeout(() => setManualTest(false), 3000);
  };

  useEffect(() => {
    if (typingUsers.length > 0) {
      setLastEvent(`Users typing: ${typingUsers.map(u => u.user_id).join(", ")}`);
    } else {
      setLastEvent("No one typing");
    }
  }, [typingUsers]);

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-xs">
      <h3 className="font-bold mb-2">🧪 Typing Status Debug</h3>
      <div className="space-y-1">
        <p>
          <strong>Room ID:</strong> {roomId}
        </p>
        <p>
          <strong>User ID:</strong> {userId}
        </p>
        <p>
          <strong>Last Event:</strong> {lastEvent}
        </p>
        <p>
          <strong>Typing Users Count:</strong> {typingUsers.length}
        </p>
        <p>
          <strong>Active Typing Users:</strong>
        </p>
        <ul className="bg-gray-100 p-2 rounded text-xs">
          {typingUsers.map((user, index) => (
            <li key={user.user_id} className="flex justify-between">
              <span>User: {user.user_id.slice(0, 8)}...</span>
              <span>Since: {new Date(user.updated_at).toLocaleTimeString()}</span>
            </li>
          ))}
          {typingUsers.length === 0 && <li>No one is typing</li>}
        </ul>
      </div>
      
      <div className="mt-3 space-y-2">
        <button 
          onClick={testTyping}
          className={`w-full px-3 py-2 rounded text-sm ${
            manualTest ? "bg-green-500 text-white" : "bg-blue-500 text-white"
          }`}
        >
          {manualTest ? "✅ Typing Triggered" : "Test Typing Indicator"}
        </button>
        
        <div className="text-xs text-gray-600">
          <p>
            <strong>How to test:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open another browser/tab with the same room</li>
            <li>Click &quot;Test Typing Indicator&quot; here</li>
            <li>Check if typing appears in the other tab</li>
            <li>Type in ChatInput to test real usage</li>
          </ol>
        </div>
      </div>
    </div>
  );
}