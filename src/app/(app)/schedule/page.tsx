import { createClient } from "@/lib/supabase/server";
import { autoPromoteDueScheduledSessions } from "@/lib/scheduled-game-day-promotion";
import { getCurrentRole } from "@/lib/auth-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "@/components/schedule/calendar-view";
import { ScheduledSessionsList } from "@/components/schedule/scheduled-sessions-list";
import type { ScheduledSessionWithRoster } from "@/components/schedule/scheduled-session-dialog";
import type { Player, ScheduledGameDay, Venue } from "@/lib/types";

export default async function SchedulePage() {
  const supabase = await createClient();
  await autoPromoteDueScheduledSessions(supabase);

  const [
    { data: scheduledSessions },
    { data: rosterRows },
    { data: venues },
    { data: players },
    role,
  ] = await Promise.all([
    supabase
      .from("scheduled_game_days")
      .select("*")
      .order("session_date", { ascending: true })
      .order("session_time", { ascending: true }),
    supabase.from("scheduled_game_day_players").select("scheduled_game_day_id, player_id"),
    supabase.from("venues").select("*").order("name"),
    supabase.from("players").select("*").order("name"),
    getCurrentRole(supabase),
  ]);
  const isAdmin = role === "admin";

  const rosterBySession = new Map<string, string[]>();
  for (const row of rosterRows ?? []) {
    const list = rosterBySession.get(row.scheduled_game_day_id) ?? [];
    list.push(row.player_id);
    rosterBySession.set(row.scheduled_game_day_id, list);
  }

  const allSessions: ScheduledSessionWithRoster[] = ((scheduledSessions ?? []) as ScheduledGameDay[]).map(
    (session) => ({
      ...session,
      playerIds: rosterBySession.get(session.id) ?? [],
    })
  );
  // Promoted sessions have already become real Game Days — only unpromoted
  // ones are still "upcoming" and editable. The calendar's day markers,
  // though, should keep showing every day that ever had a session, promoted
  // or not, so a day's mark doesn't disappear once its session runs.
  const upcomingSessions = allSessions.filter((s) => !s.promoted_game_day_id);
  const markedDates = allSessions.map((s) => s.session_date);

  const venueList = (venues ?? []) as Venue[];
  const playerList = (players ?? []) as Player[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Plan future Game Day sessions — click a day to schedule one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CalendarView
          sessions={upcomingSessions}
          markedDates={markedDates}
          venues={venueList}
          players={playerList}
        />

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduledSessionsList
              sessions={upcomingSessions}
              venues={venueList}
              players={playerList}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
