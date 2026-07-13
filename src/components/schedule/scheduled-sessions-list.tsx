"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { formatTimeOfDay } from "@/lib/format";
import { ScheduledSessionDialog, type ScheduledSessionWithRoster } from "./scheduled-session-dialog";
import type { Player, Venue } from "@/lib/types";

export function ScheduledSessionsList({
  sessions,
  venues,
  players,
  emptyMessage = "No upcoming sessions scheduled.",
}: {
  sessions: ScheduledSessionWithRoster[];
  venues: Venue[];
  players: Player[];
  emptyMessage?: string;
}) {
  const [editing, setEditing] = useState<ScheduledSessionWithRoster | null>(null);
  const venuesById = new Map(venues.map((v) => [v.id, v]));

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {sessions.map((session) => {
          const venue = session.venue_id ? venuesById.get(session.venue_id) : null;
          return (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => setEditing(session)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <CalendarClock className="size-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {format(parseISO(session.session_date), "EEE, MMM d")} &middot;{" "}
                      {formatTimeOfDay(session.session_time)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {venue.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {session.playerIds.length} player{session.playerIds.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <ScheduledSessionDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          date={editing.session_date}
          session={editing}
          venues={venues}
          players={players}
        />
      )}
    </>
  );
}
