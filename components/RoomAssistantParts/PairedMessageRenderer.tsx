"use client";

import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
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
import Image from "next/image";
import { ChatMessage } from "../RoomAssistant";

function formatTimestamp(value?: string | Date) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dedupeConsecutiveParagraphs(text: string): string {
  if (!text) return text;
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return text.trim();

  const out: string[] = [];
  for (const p of parts) {
    if (p !== out[out.length - 1]) out.push(p);
  }
  return out.join("\n\n");
}

export const PairedMessageRenderer = memo(
  ({ pair }: { pair: { user: ChatMessage; assistant?: ChatMessage }; theme: "light" | "dark" }) => {
    const handleCopy = () => {
      if (!pair.assistant?.content) return;
      navigator.clipboard.writeText(pair.assistant.content);
      toast.success("Response copied!");
    };

    /** -----------------------------
     *  PROCESS ASSISTANT → Sanitize + Dedupe + Markdown
     * ------------------------------ */
    const assistantRendered = useMemo(() => {
      if (!pair.assistant?.content) return null;

      const safe = DOMPurify.sanitize(pair.assistant.content);
      const cleaned = dedupeConsecutiveParagraphs(safe);

      const components: Components = {
        p: (props) => <p className="my-1 leading-relaxed">{props.children}</p>,

        code: ({ children, className }: any) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <pre className="bg-muted/20 p-3 rounded-md overflow-x-auto">
              <code className={className}>{children}</code>
            </pre>
          );
        },

        img: ({ src, alt }: any) => {
          if (!src) return null;
          return (
            <Image
              src={src}
              alt={alt ?? ""}
              width={600}
              height={400}
              className="rounded max-w-full"
            />
          );
        },

        a: ({ href, children }: any) =>
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
      };

      return (
        <ReactMarkdown components={components}>
          {cleaned}
        </ReactMarkdown>
      );
    }, [pair.assistant?.content]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-3"
      >
        {/* USER MESSAGE */}
        <Card className="bg-muted/30 border rounded-xl">
          <CardContent className="px-3 py-2.5 flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center">
              <User className="h-3.5 w-3.5" />
            </div>

            <div className="flex-1">
              <p className="text-sm">{pair.user.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatTimestamp(pair.user.timestamp)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI MESSAGE */}
        {pair.assistant && (
          <>
            <Separator className="my-2" />

            <Card className="bg-background/80 border rounded-xl shadow-sm backdrop-blur">
              <CardContent className="px-3 py-3 space-y-3">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        AI Assistant • {pair.assistant.model ?? "Assistant"}
                      </p>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleCopy}
                              className="h-7 w-7"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy response</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Rendered Markdown */}
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {assistantRendered}
                    </div>

                    <p className="text-xs text-muted-foreground pt-2 border-t mt-4">
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
