"use client";

import {
  useState,
  useRef,
  useTransition,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Loader2,
  Send,
  X,
  Copy,
  RefreshCw,
  Download,
  Trash2,
  AlertCircle,
  MessageSquare,
  MoreVertical,
  Sparkles,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useMessage, Imessage } from "@/lib/store/messages";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
};

interface RoomAssistantProps {
  roomId: string;
  roomName: string;
  className?: string;
  maxPromptLength?: number;
  maxHistory?: number;
  initialModel?: string;
}

// 🧱 Enhanced Chat Message Component with safe timestamp handling
const ChatMessageDisplay = ({ msg, copyToClipboard }: { msg: ChatMessage, copyToClipboard: (content: string) => void }) => {
  // Safe timestamp conversion
  const safeTimestamp = useMemo(() => {
    try {
      if (msg.timestamp instanceof Date) {
        return msg.timestamp;
      }
      if (typeof msg.timestamp === 'string') {
        return new Date(msg.timestamp);
      }
      if (typeof msg.timestamp === 'number') {
        return new Date(msg.timestamp);
      }
      return new Date(); // Fallback to current date
    } catch (error) {
      console.error('Invalid timestamp:', msg.timestamp, error);
      return new Date(); // Fallback to current date
    }
  }, [msg.timestamp]);

  // Safe time formatting
  const formattedTime = useMemo(() => {
    try {
      return safeTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--';
    }
  }, [safeTimestamp]);

  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
    >
      <div
        className={`relative max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-lg transition-all duration-300 ${
          msg.role === "user"
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
            : "bg-gradient-to-br from-white to-gray-50 border border-gray-100 rounded-tl-md shadow-sm"
        }`}
      >
        {/* Message Content */}
        <div className="whitespace-pre-wrap leading-relaxed">
          <ReactMarkdown
            components={{
              // Enhanced table styling
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200" {...props} />
                </div>
              ),
              th: ({ node, ...props }) => (
                <th 
                  className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b" 
                  {...props} 
                />
              ),
              td: ({ node, ...props }) => (
                <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100" {...props} />
              ),
              
              code: ({ node, className, ...props }) => {
                  const isInline = !className?.includes('language-');
                  return isInline ? (
                  <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono" {...props} />
                  ) : (
                  <code className="block p-3 bg-gray-900 text-gray-100 rounded-lg text-sm font-mono overflow-x-auto" {...props} />
                  );
              },
              // Enhanced lists
              ul: ({ node, ...props }) => (
                <ul className="space-y-1 my-2 list-disc list-inside" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="space-y-1 my-2 list-decimal list-inside" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="pl-1" {...props} />
              ),
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>

        {/* Message Footer */}
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-opacity-20">
          <span className={`text-xs font-medium ${msg.role === "user" ? "text-blue-100" : "text-gray-500"}`}>
            {msg.role === "user" ? "You" : `AI Assistant • ${msg.model || 'Model'}`}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${msg.role === "user" ? "text-blue-100" : "text-gray-400"}`}>
              {formattedTime}
            </span>
            {msg.role === "assistant" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(msg.content)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function RoomAssistant({
  roomId,
  roomName,
  className = "",
  maxPromptLength = 500,
  maxHistory = 10,
  initialModel = "gpt-3.5-turbo",
}: RoomAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState(initialModel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, startTransition] = useTransition();
  const { messages: allMessages } = useMessage();

  // Recent room messages for context
  const recentRoomMessages = useMemo(() => {
    return allMessages
      .filter((msg: Imessage) => msg.room_id === roomId)
      .slice(-20)
      .map((msg: Imessage) => {
        const sender = msg.profiles?.display_name || msg.profiles?.username || "User";
        return `${sender} (${msg.created_at}): ${msg.text}`;
      })
      .join("\n");
  }, [allMessages, roomId]);

  // Safe message loading with timestamp conversion
  const loadMessagesFromStorage = useCallback(() => {
    try {
      const key = `ai-chat-${roomId}`;
      const saved = localStorage.getItem(key);
      if (saved && messages.length === 0) {
        const parsedMessages = JSON.parse(saved);
        
        // Convert timestamp strings to Date objects
        const messagesWithProperTimestamps = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(messagesWithProperTimestamps);
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
      // Clear corrupted data
      localStorage.removeItem(`ai-chat-${roomId}`);
    }
  }, [roomId, messages.length]);

  // Safe message saving
  const saveMessagesToStorage = useCallback(() => {
    try {
      const key = `ai-chat-${roomId}`;
      localStorage.setItem(key, JSON.stringify(messages.slice(-maxHistory)));
    } catch (e) {
      console.error("Failed to save chat history:", e);
    }
  }, [messages, roomId, maxHistory]);

  // Handlers
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value.slice(0, maxPromptLength));
    },
    [maxPromptLength]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!prompt.trim()) {
        toast.error("Please enter a query about the room.");
        return;
      }

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(-maxHistory + 1), userMsg]);
      const tempPrompt = prompt;
      setPrompt("");
      setLoading(true);
      setError(null);
      setIsStreaming(true);

      startTransition(async () => {
        try {
          const historyStr = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n") + `\n${userMsg.role}: ${tempPrompt}`;
          const context = recentRoomMessages
            ? `Room "${roomName}" (${roomId}) recent:\n${recentRoomMessages}\n\nHistory:\n${historyStr}`
            : `Room "${roomName}" (${roomId}). History:\n${historyStr}`;
          const estTokens = context.length / 4 + 200;

          if (estTokens > 4000) throw new Error("Context too long—please shorten your query.");

          const res = await fetch("/api/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: `${context}\n\nAssistant:`, model }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "API request failed");
          }

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let fullResponse = "";
          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "",
            timestamp: new Date(),
            model,
          };
          setMessages((prev) => [...prev, aiMsg]);

          while (true) {
            const { done, value } = await reader?.read() ?? { done: true };
            if (done) break;
            const chunk = decoder.decode(value);
            fullResponse += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsg.id ? { ...m, content: fullResponse } : m
              )
            );
          }

          toast.success(`Response generated successfully!`);
        } catch (err) {
          setMessages((prev) => prev.slice(0, -1));
          const msg = (err as Error).message;
          setError(msg.includes("429") ? "Rate limit exceeded. Please try again soon." : msg);
          toast.error(msg, { 
            action: { 
              label: "Retry", 
              onClick: () => handleSubmit() 
            } 
          });
        } finally {
          setLoading(false);
          setIsStreaming(false);
        }
      });
    },
    [prompt, messages, recentRoomMessages, roomName, roomId, model, maxHistory]
  );

  const copyToClipboard = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    toast.success("Chat history cleared!");
  }, []);

  const regenerate = useCallback(() => {
    const lastUser = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
    if (lastUser) {
      setMessages((prev) => prev.slice(0, prev.findIndex(m => m.role === 'assistant')));
      setPrompt(lastUser);
      handleSubmit();
    } else {
      toast.error("No previous message to regenerate.");
    }
  }, [messages, handleSubmit]);

  const exportChat = useCallback(() => {
    const data = messages.map((m) => ({
      role: m.role,
      content: m.content,
      time: m.timestamp.toISOString(),
      model: m.model,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported successfully!");
  }, [messages, roomName]);

  // Local persistence with error handling
  useEffect(() => {
    loadMessagesFromStorage();
  }, [loadMessagesFromStorage]);

  useEffect(() => {
    saveMessagesToStorage();
  }, [saveMessagesToStorage]);

  // Auto-focus textarea when component mounts
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <motion.div
      className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 w-full h-full max-w-4xl mx-auto overflow-hidden ${className}`}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
    >
      {/* 🔝 Enhanced Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-gray-900 text-sm">Room Assistant</h3>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className="text-xs bg-white/80 backdrop-blur-sm text-blue-700 border-blue-200 font-medium"
              >
                {model}
              </Badge>
              <span className="text-xs text-gray-500">#{roomName}</span>
            </div>
          </div>
        </div>

        {/* Actions Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-white/50"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 p-2 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl"
            align="end"
          >
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                disabled={loading || messages.length === 0}
                className="w-full justify-start text-sm text-gray-700 hover:bg-gray-100"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
              {messages.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={regenerate}
                  disabled={loading}
                  className="w-full justify-start text-sm text-gray-700 hover:bg-gray-100"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportChat}
                  className="w-full justify-start text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Chat
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 🧾 Enhanced Messages Area - Full Height with Scroll */}
      <ScrollArea className="flex-1 px-4 py-4 min-h-[200px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {messages.length > 0 ? (
            <div className="space-y-4 pb-4">
              {messages.map((msg) => (
                <ChatMessageDisplay 
                  key={msg.id} 
                  msg={msg} 
                  copyToClipboard={copyToClipboard} 
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full min-h-[300px] text-center"
            >
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Room AI Assistant</h3>
              <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
                Ask me anything about <strong>#{roomName}</strong>. I can analyze the last 20 messages and provide insights, summaries, and more.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* ⚠️ Enhanced Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 bg-red-50 border-t border-red-100"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0 text-red-500 hover:bg-red-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📝 Enhanced Input Area */}
      <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder={`Ask about #${roomName}...`}
            value={prompt}
            onChange={handleInputChange}
            className="min-h-[80px] resize-none pr-12 bg-white border-gray-200 rounded-xl focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            disabled={loading}
            maxLength={maxPromptLength}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className={`text-xs ${prompt.length > maxPromptLength * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
              {prompt.length}/{maxPromptLength}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Select value={model} onValueChange={setModel} disabled={loading}>
            <SelectTrigger className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 h-auto focus:ring-2 focus:ring-blue-100 transition-all duration-200">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 rounded-lg shadow-lg">
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini (Enhanced)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isStreaming ? "Generating..." : "Processing..."}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}