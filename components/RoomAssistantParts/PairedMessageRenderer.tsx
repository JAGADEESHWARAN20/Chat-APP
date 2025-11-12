"use client";

import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type { Components } from "react-markdown";
import ReactMarkdownImport from "react-markdown";
import DOMPurify from "dompurify";
import { Bot, User, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipProvider,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ✅ Fix for className typing on ReactMarkdown
const ReactMarkdown = ReactMarkdownImport as unknown as React.FC<
  React.ComponentPropsWithoutRef<typeof ReactMarkdownImport> & { className?: string }
>;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string | Date;
  model?: string;
  structuredData?: any;
}

// ✅ Safe timestamp formatter (handles both string and Date)
function formatTimestamp(value?: string | Date): string {
  if (!value) return "";
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export const PairedMessageRenderer = memo(
  ({
    pair,
    theme,
  }: {
    pair: { user: ChatMessage; assistant?: ChatMessage };
    theme: "light" | "dark";
  }) => {
    const handleCopy = () => {
      if (!pair.assistant?.content) return;
      navigator.clipboard.writeText(pair.assistant.content);
      toast.success("Response copied!");
    };

    // ✅ Sanitize + render markdown
    const renderContent = useMemo(() => {
      if (!pair.assistant) return null;
      const safeMarkdown = DOMPurify.sanitize(pair.assistant.content);

      const components: Components = {
        p: ({ children }) => <p className="my-1.5">{children}</p>,
        li: ({ children }) => <li className="my-0.5">{children}</li>,
        code: ({ children }) => (
          <code className="bg-[hsl(var(--muted))]/60 px-1 py-0.5 rounded text-xs font-mono">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--action-active))] hover:underline"
          >
            {children}
          </a>
        ),
      };

      return (
        <ReactMarkdown
          className="prose prose-sm max-w-none leading-relaxed 
                     text-[hsl(var(--foreground))] dark:prose-invert"
          components={components}
        >
          {safeMarkdown}
        </ReactMarkdown>
      );
    }, [pair.assistant]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-3"
      >
        {/* 🧍 USER MESSAGE */}
        <Card className="bg-[hsl(var(--muted))]/40 border-border/30 backdrop-blur-sm rounded-xl">
          <CardContent className="p-3 flex gap-3 items-start">
            <div className="w-7 h-7 flex items-center justify-center bg-[hsl(var(--action-active))]/80 text-white rounded-full flex-shrink-0">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground leading-snug">{pair.user.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatTimestamp(pair.user.timestamp)}
              </p>
            </div>
          </CardContent>
        </Card>

        {pair.assistant && (
          <>
            <Separator className="my-2 bg-border/40" />
            <Card className="border-border/30 bg-[hsl(var(--background))]/80 backdrop-blur-md shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/70] flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      AI • {pair.assistant.model || "Assistant"}
                    </p>
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopy}
                          className="h-7 w-7 opacity-70 hover:opacity-100 hover:bg-[hsl(var(--muted))]/40 transition-all"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy response</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="text-sm text-muted-foreground">{renderContent}</div>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    );
  }
);

PairedMessageRenderer.displayName = "PairedMessageRenderer";
