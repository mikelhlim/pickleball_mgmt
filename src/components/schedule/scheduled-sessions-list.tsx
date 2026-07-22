"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, Hash, MapPin, Users } from "lucide-react";
import { formatTimeOfDay } from "@/lib/format";
import { ScheduledSessionDialog, type ScheduledSessionWithRoster } from "./scheduled-session-dialog";
import { DeleteScheduledSessionButton } from "./delete-scheduled-session-button";
import { SendReminderButton } from "./send-reminder-button";
import type { Player, Venue } from "@/lib/types";

export function ScheduledSessionsList({
  sessions,
  venues,
  players,
  isAdmin = false,
  emptyMessage = "No upcoming sessions scheduled.",
}: {
  sessions: ScheduledSessionWithRoster[];
  venues: Venue[];
  players: Player[];
  isAdmin?: boolean;
  emptyMessage?: string;
}) {
  const [editing, setEditing] = useState<ScheduledSessionWithRoster | null>(null);
  const venuesById = new Map(venues.map((v) => [v.id, v]));
  const playersById = new Map(players.map((p) => [p.id, p]));

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {sessions.map((session) => {
          const venue = session.venue_id ? venuesById.get(session.venue_id) : null;
          const timeLabel = session.end_time
            ? `${formatTimeOfDay(session.session_time)}–${formatTimeOfDay(session.end_time)}`
            : formatTimeOfDay(session.session_time);
          const label = `${format(parseISO(session.session_date), "EEE, MMM d")} · ${timeLabel}`;
          return (
            <li key={session.id} className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEditing(session)}
                className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <CalendarClock className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {venue.name}
                      </span>
                    )}
                    {session.court_number && (
                      <span className="flex items-center gap-1">
                        <Hash className="size-3" />
                        Court {session.court_number}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {session.playerIds.length} player{session.playerIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </button>
              {isAdmin && (
                <SendReminderButton
                  sessionId={session.id}
                  label={label}
                  recipientCount={
                    session.playerIds.filter((id) => playersById.get(id)?.email).length
                  }
                />
              )}
              <DeleteScheduledSessionButton sessionId={session.id} label={label} />
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
