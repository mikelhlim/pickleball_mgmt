import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { autoEndIfExpired } from "@/lib/game-day-lifecycle";
import { getCurrentRole } from "@/lib/auth-role";
import { NewGameDayDialog } from "@/components/game-days/new-game-day-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatHoursMinutesBetween, formatTime } from "@/lib/format";
import type { GameDay, Venue } from "@/lib/types";

const statusVariant: Record<GameDay["status"], "default" | "secondary" | "outline"> = {
  setup: "outline",
  in_progress: "default",
  completed: "secondary",
};

export default async function GameDaysPage() {
  const supabase = await createClient();
  const [{ data: gameDays }, { data: venues }] = await Promise.all([
    supabase.from("game_days").select("*").order("session_date", { ascending: false }),
    supabase.from("venues").select("*").order("name"),
  ]);

  const venuesById = new Map(((venues ?? []) as Venue[]).map((v) => [v.id, v]));
  const [sessions, role] = await Promise.all([
    Promise.all(((gameDays ?? []) as GameDay[]).map((gd) => autoEndIfExpired(supabase, gd))),
    getCurrentRole(supabase),
  ]);
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Game Days</h1>
          <p className="text-sm text-muted-foreground">Create and run open-play sessions.</p>
        </div>
        {isAdmin && <NewGameDayDialog venues={(venues ?? []) as Venue[]} />}
      </div>

      {sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((gameDay) => (
            <Link key={gameDay.id} href={`/game-days/${gameDay.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {format(parseISO(gameDay.session_date), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {gameDay.num_matches} matches
                      {gameDay.venue_id && venuesById.get(gameDay.venue_id) && (
                        <> · {venuesById.get(gameDay.venue_id)!.name}</>
                      )}
                      {gameDay.started_at && <> · Started {formatTime(gameDay.started_at)}</>}
                      {gameDay.ended_at && <> · Ended {formatTime(gameDay.ended_at)}</>}
                      {gameDay.started_at && gameDay.ended_at && (
                        <> · {formatHoursMinutesBetween(gameDay.started_at, gameDay.ended_at)}</>
                      )}
                    </p>
                  </div>
                  <Badge variant={statusVariant[gameDay.status]}>
                    {gameDay.status.replace("_", " ")}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No game days yet. Create one to get started.</p>
      )}
    </div>
  );
}
