"use client";

import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
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
import { toast } from "@/components/ui/sonner";
import { ChatMessage } from "../RoomAssistant";

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

/**
 * Remove consecutive duplicate paragraph blocks.
 */
function dedupeConsecutiveParagraphs(text: string): string {
  if (!text) return text;
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return text.trim();

  const filtered: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    const prev = filtered[filtered.length - 1];
    if (cur && cur !== prev) filtered.push(cur);
  }
  return filtered.join("\n\n");
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

    /**
     * ASSISTANT CONTENT → sanitized + deduped + rendered
     */
    const assistantRendered = useMemo(() => {
      if (!pair.assistant?.content) return null;

      // STEP 1: Sanitize HTML input
      const safe = DOMPurify.sanitize(pair.assistant.content);

      // STEP 2: Remove repeated paragraphs
      const cleaned = dedupeConsecutiveParagraphs(safe);

      // STEP 3: Markdown overrides
      const components: Components = {
        p: ({ children, ...props }) => (
          <p className="my-1 leading-relaxed" {...props}>
            {children}
          </p>
        ),
        h1: ({ children, ...props }) => (
          <h1 className="text-xl font-semibold mt-4 mb-2" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="text-lg font-semibold mt-3 mb-1.5" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="text-base font-medium mt-2 mb-1" {...props}>
            {children}
          </h3>
        ),
        h4: ({ children, ...props }) => (
          <h4 className="text-sm font-medium mt-2 mb-1" {...props}>
            {children}
          </h4>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc pl-5 space-y-1" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="list-decimal pl-5 space-y-1" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li className="my-0.5" {...props}>
            {children}
          </li>
        ),
        strong: ({ children, ...props }) => (
          <strong className="font-semibold" {...props}>
            {children}
          </strong>
        ),
        em: ({ children, ...props }) => (
          <em className="italic" {...props}>
            {children}
          </em>
        ),
        blockquote: ({ children, ...props }) => (
          <blockquote
            className="pl-4 border-l-2 border-border/30 italic text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        ),
        code: ({ inline, children, className, ...props }) => {
          if (inline) {
            return (
              <code
                className="bg-[hsl(var(--muted))]/60 px-1.5 py-0.5 rounded text-[0.75rem] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <pre className="rounded-md overflow-x-auto p-3 bg-[hsl(var(--muted))]/10">
              <code className={className}>{children}</code>
            </pre>
          );
        },
        a: ({ href, children, title, ...props }) => {
          if (!href) return <span {...props}>{children}</span>;
          return (
            <a
              href={href}
              title={title}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--primary))] hover:underline"
              {...props}
            >
              {children}
            </a>
          );
        },
        img: ({ src, alt, title, ...props }) => {
          if (!src) return null;
          return (
            <img
              src={src}
              alt={alt ?? ""}
              title={title}
              className="max-w-full rounded"
              {...props}
            />
          );
        },
        hr: (props) => <hr className="my-3 border-border/20" {...props} />,
      };

      return (
        <div className="prose prose-sm max-w-none leading-relaxed text-[hsl(var(--foreground))] dark:prose-invert">
          <ReactMarkdown components={components}>{cleaned}</ReactMarkdown>
        </div>
      );
    }, [pair.assistant?.content, theme]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-3"
      >
        {/* USER MESSAGE – raw, untouched */}
        <Card className="bg-[hsl(var(--muted))]/30 border border-border/30 backdrop-blur-sm rounded-xl">
          <CardContent className="px-3 py-2.5 flex gap-2 items-start">
            <div className="w-7 h-7 flex items-center justify-center bg-[hsl(var(--primary))]/70 text-white rounded-full flex-shrink-0">
              <User className="h-3.5 w-3.5" />
            </div>

            <div className="flex-1">
              <p className="text-[0.85rem] text-foreground leading-snug">
                {pair.user.content}
              </p>
              <p className="text-[0.7rem] text-muted-foreground mt-1">
                {formatTimestamp(pair.user.timestamp)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ASSISTANT MESSAGE */}
        {pair.assistant && (
          <>
            <Separator className="my-2 bg-border/30" />
            <Card className="border border-border/20 bg-[hsl(var(--background))]/80 backdrop-blur-lg shadow-sm rounded-xl">
              <CardContent className="px-3 py-3 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--primary))]
                    to-[hsl(var(--primary))/70] flex items-center justify-center flex-shrink-0"
                  >
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[0.7rem] font-medium text-muted-foreground">
                        AI Assistant • {pair.assistant.model || "Assistant"}
                      </p>

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
                          <TooltipContent side="top" className="text-xs">
                            Copy response
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Sanitized + deduped Markdown */}
                    <div className="text-[0.82rem] text-muted-foreground leading-relaxed">
                      {assistantRendered}
                    </div>

                    <p className="text-[0.7rem] text-muted-foreground pt-2 border-t border-border/20 mt-4">
                      {formatTimestamp(pair.assistant.timestamp)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    );
  }
);

PairedMessageRenderer.displayName = "PairedMessageRenderer";
export default PairedMessageRenderer;
