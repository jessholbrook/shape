"use client";

import { useEffect } from "react";
import { markRead } from "@/lib/learn-progress";

/**
 * Mounts inside an article body and flags the slug as read in localStorage.
 * Renders nothing. Keeps article pages themselves server-rendered.
 */
export function MarkAsRead({ slug }: { slug: string }) {
  useEffect(() => {
    markRead(slug);
  }, [slug]);
  return null;
}
