import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { StatsCharts } from "@/components/statistics/stats-charts";
import { PartnershipTable } from "@/components/statistics/partnership-table";
import { VenueChart } from "@/components/statistics/venue-chart";
import { StatsChatbot } from "@/components/statistics/stats-chatbot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormattedTime } from "@/components/ui/formatted-time";
import type { GameDay, PartnershipStats, PlayerStats, Venue } from "@/lib/types";

export default async function StatisticsPage() {
  const supabase = await createClient();

  const [
    { data: playerStats },
    { data: partnershipStats },
    { data: players },
    { data: gameDays },
    { data: venues },
  ] = await Promise.all([
    supabase.from("player_stats").select("*").order("wins", { ascending: false }),
    supabase.from("partnership_stats").select("*"),
    supabase.from("players").select("id, name, nickname"),
    supabase.from("game_days").select("*").order("session_date", { ascending: false }),
    supabase.from("venues").select("*").order("name"),
  ]);

  const nameById = new Map(
    (players ?? []).map((p: { id: string; name: string; nickname: string | null }) => [
      p.id,
      p.nickname || p.name,
    ])
  );

  const sessionCountByVenue = new Map<string, number>();
  for (const gd of (gameDays ?? []) as GameDay[]) {
    if (!gd.venue_id) continue;
    sessionCountByVenue.set(gd.venue_id, (sessionCountByVenue.get(gd.venue_id) ?? 0) + 1);
  }
  const venueChartData = ((venues ?? []) as Venue[])
    .map((v) => ({ name: v.name, sessions: sessionCountByVenue.get(v.id) ?? 0 }))
    .filter((v) => v.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground">Win/loss records across all game days.</p>
      </div>

      <StatsChatbot />

      <Card>
        <CardHeader>
          <CardTitle>Wins &amp; Losses per Player</CardTitle>
        </CardHeader>
        <CardContent>
          <StatsCharts playerStats={(playerStats ?? []) as PlayerStats[]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Pairings</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnershipTable
            partnerships={(partnershipStats ?? []) as PartnershipStats[]}
            nameById={nameById}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game Day History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {(gameDays ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No game days yet.</p>
          )}
          {((gameDays ?? []) as GameDay[]).map((gd) => (
            <Link
              key={gd.id}
              href={`/statistics/${gd.id}`}
              className="flex items-center justify-between gap-3 rounded-md p-2 text-sm hover:bg-accent"
            >
              <span>
                {format(parseISO(gd.session_date), "EEEE, MMMM d, yyyy")}
                {gd.status === "completed" && gd.ended_at && (
                  <span className="text-muted-foreground">
                  {" "}
                  · Ended <FormattedTime iso={gd.ended_at} />
                </span>
                )}
              </span>
              <Badge variant="outline">{gd.status.replace("_", " ")}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Games per Venue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VenueChart data={venueChartData} />
          {venueChartData.length > 0 && (
            <div className="space-y-1">
              {venueChartData.map((v) => (
                <div key={v.name} className="flex items-center justify-between text-sm">
                  <span>{v.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {v.sessions} {v.sessions === 1 ? "session" : "sessions"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
