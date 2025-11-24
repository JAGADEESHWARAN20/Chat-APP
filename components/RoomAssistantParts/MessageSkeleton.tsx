"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export const MessageSkeleton = memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    className="space-y-4 "
  >
    {/* USER */}
    <div className="p-3 rounded-xl bg-[hsl(var(--muted))]/40 backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-3/4 mb-1" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
    </div>

    <Separator className="bg-border/30" />

    {/* ASSISTANT */}
    <div className="p-4 rounded-xl border border-border/30 bg-[hsl(var(--background))]/60 backdrop-blur-sm shadow-sm">
      <div className="flex items-start gap-2 mb-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-2.5 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-12 w-full mb-2" />
      <Skeleton className="h-3 w-1/5" />
    </div>
  </motion.div>
));

MessageSkeleton.displayName = "MessageSkeleton";
