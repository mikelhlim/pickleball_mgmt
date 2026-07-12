"use client";

import { useSyncExternalStore } from "react";
import { formatTime } from "@/lib/format";

// Server Components format dates using the server's local timezone (UTC on
// Vercel), which doesn't match a Philippines-based viewer's clock. Deferring
// the format until after hydration makes it use the browser's own timezone
// instead. useSyncExternalStore (rather than an effect + setState) is what
// gives a consistent "false" snapshot on both the server render and the
// pre-hydration client render — no hydration mismatch — before flipping to
// "true" once mounted.
const noopSubscribe = () => () => {};

export function FormattedTime({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  return isClient ? formatTime(iso) : null;
}
