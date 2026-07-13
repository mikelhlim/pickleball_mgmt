import { createClient } from "@/lib/supabase/server";
import { autoPromoteDueScheduledSessions } from "@/lib/scheduled-game-day-promotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "@/components/schedule/calendar-view";
import { ScheduledSessionsList } from "@/components/schedule/scheduled-sessions-list";
import type { ScheduledSessionWithRoster } from "@/components/schedule/scheduled-session-dialog";
import type { Player, ScheduledGameDay, Venue } from "@/lib/types";

export default async function SchedulePage() {
  const supabase = await createClient();
  await autoPromoteDueScheduledSessions(supabase);

  const [{ data: scheduledSessions }, { data: rosterRows }, { data: venues }, { data: players }] =
    await Promise.all([
      supabase
        .from("scheduled_game_days")
        .select("*")
        .is("promoted_game_day_id", null)
        .order("session_date", { ascending: true })
        .order("session_time", { ascending: true }),
      supabase.from("scheduled_game_day_players").select("scheduled_game_day_id, player_id"),
      supabase.from("venues").select("*").order("name"),
      supabase.from("players").select("*").order("name"),
    ]);

  const rosterBySession = new Map<string, string[]>();
  for (const row of rosterRows ?? []) {
    const list = rosterBySession.get(row.scheduled_game_day_id) ?? [];
    list.push(row.player_id);
    rosterBySession.set(row.scheduled_game_day_id, list);
  }

  const sessions: ScheduledSessionWithRoster[] = ((scheduledSessions ?? []) as ScheduledGameDay[]).map(
    (session) => ({
      ...session,
      playerIds: rosterBySession.get(session.id) ?? [],
    })
  );

  const venueList = (venues ?? []) as Venue[];
  const playerList = (players ?? []) as Player[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Plan future Game Day sessions — click a day to schedule one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CalendarView sessions={sessions} venues={venueList} players={playerList} />

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduledSessionsList sessions={sessions} venues={venueList} players={playerList} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
