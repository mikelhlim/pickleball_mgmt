import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { NewGameDayDialog } from "@/components/game-days/new-game-day-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Game Days</h1>
          <p className="text-sm text-muted-foreground">Create and run open-play sessions.</p>
        </div>
        <NewGameDayDialog venues={(venues ?? []) as Venue[]} />
      </div>

      {gameDays && gameDays.length > 0 ? (
        <div className="space-y-3">
          {(gameDays as GameDay[]).map((gameDay) => (
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
