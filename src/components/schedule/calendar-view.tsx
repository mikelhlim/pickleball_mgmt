"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduledSessionDialog, type ScheduledSessionWithRoster } from "./scheduled-session-dialog";
import { cn } from "@/lib/utils";
import type { Player, Venue } from "@/lib/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  sessions,
  venues,
  players,
}: {
  sessions: ScheduledSessionWithRoster[];
  venues: Venue[];
  players: Player[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dialogState, setDialogState] = useState<{
    date: string;
    session?: ScheduledSessionWithRoster;
  } | null>(null);

  const sessionsByDate = new Map(sessions.map((s) => [s.session_date, s]));

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function handleDayClick(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    setDialogState({ date: key, session: sessionsByDate.get(key) });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{format(month, "MMMM yyyy")}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const session = sessionsByDate.get(key);
              const inMonth = isSameMonth(day, month);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-md text-sm transition-colors hover:bg-accent",
                    !inMonth && "text-muted-foreground/40",
                    isToday(day) && "font-semibold text-primary"
                  )}
                >
                  {format(day, "d")}
                  {session && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {dialogState && (
        <ScheduledSessionDialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          date={dialogState.date}
          session={dialogState.session}
          venues={venues}
          players={players}
        />
      )}
    </>
  );
}
