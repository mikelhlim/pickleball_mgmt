"use client";

import { useRef } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GameDayStatus } from "@/lib/types";

export type SessionCardData = {
  id: string;
  status: GameDayStatus;
  numMatches: number;
  venueName: string | null;
  liveMatchNumber: number | null;
};

export type SessionGroup = {
  date: string;
  sessions: SessionCardData[];
};

const statusVariant: Record<GameDayStatus, "default" | "secondary" | "outline"> = {
  setup: "outline",
  in_progress: "default",
  completed: "secondary",
};

const CARD_WIDTH = 208; // px, matches the `w-52` group block below

export function SessionScroller({ groups }: { groups: SessionGroup[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * CARD_WIDTH * 3, behavior: "smooth" });
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No game days yet.{" "}
        <Link href="/game-days" className="underline">
          Create one
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border bg-background p-1.5 shadow-sm hover:bg-accent sm:flex"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scroll-smooth pb-1">
        {groups.map((group) => (
          <div key={group.date} className="w-52 flex-none rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {format(parseISO(group.date), "MMM d, yyyy")}
            </p>
            <div className="space-y-2">
              {group.sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/game-days/${session.id}`}
                  className={`block rounded-md border p-2 text-xs transition-colors hover:bg-accent ${
                    session.status === "in_progress" ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant={statusVariant[session.status]} className="text-[10px]">
                      {session.status === "in_progress" ? "Live" : session.status.replace("_", " ")}
                    </Badge>
                    <span className="text-muted-foreground">{session.numMatches}m</span>
                  </div>
                  {session.venueName && (
                    <p className="mt-1 truncate text-muted-foreground">{session.venueName}</p>
                  )}
                  {session.liveMatchNumber != null && (
                    <p className="mt-1 font-medium text-primary">
                      Match {session.liveMatchNumber} in progress
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border bg-background p-1.5 shadow-sm hover:bg-accent sm:flex"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
