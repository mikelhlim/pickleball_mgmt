"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Play, Trophy } from "lucide-react";
import { endMatch, startMatch } from "@/app/(app)/game-days/[id]/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDuration, formatTime } from "@/lib/format";
import type { Match, Player } from "@/lib/types";

function playerLabel(player: Player | null) {
  return player ? player.nickname || player.name : "Removed player";
}

function PlayerChip({ player }: { player: Player | null }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        <AvatarImage src={player?.photo_url ?? undefined} alt={playerLabel(player)} />
        <AvatarFallback className="text-xs">
          {player ? player.name.slice(0, 2).toUpperCase() : "?"}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{playerLabel(player)}</span>
    </div>
  );
}

function useElapsedSeconds(startedAt: string | null, active: boolean) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0
  );

  useEffect(() => {
    if (!active || !startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);

  return elapsed;
}

export function MatchCard({
  match,
  gameDayId,
  team1,
  team2,
  sittingOut,
  locked = false,
  isAdmin = false,
}: {
  match: Match;
  gameDayId: string;
  team1: [Player | null, Player | null];
  team2: [Player | null, Player | null];
  sittingOut: Player[];
  locked?: boolean;
  isAdmin?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [team1ScoreInput, setTeam1ScoreInput] = useState("");
  const [team2ScoreInput, setTeam2ScoreInput] = useState("");

  const elapsed = useElapsedSeconds(match.started_at, match.status === "in_progress");

  function handleStart() {
    startTransition(async () => {
      try {
        await startMatch(match.id, gameDayId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start match.");
      }
    });
  }

  function handleEnd() {
    const team1Score = Number(team1ScoreInput);
    const team2Score = Number(team2ScoreInput);

    if (team1ScoreInput === "" || team2ScoreInput === "") {
      toast.error("Enter both teams' final scores.");
      return;
    }
    if (team1Score === team2Score) {
      toast.error("Scores can't be tied — enter a final score with a winner.");
      return;
    }

    startTransition(async () => {
      try {
        await endMatch(match.id, gameDayId, team1Score, team2Score);
        setEndDialogOpen(false);
        setTeam1ScoreInput("");
        setTeam2ScoreInput("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to end match.");
      }
    });
  }

  const leadingTeam =
    team1ScoreInput !== "" && team2ScoreInput !== "" && Number(team1ScoreInput) !== Number(team2ScoreInput)
      ? Number(team1ScoreInput) > Number(team2ScoreInput)
        ? 1
        : 2
      : null;

  // A match left pending when its game day is already completed never got
  // played — treat it as cancelled for display, same as a match the 4-hour
  // auto-end explicitly marks cancelled. This covers game days that were
  // manually ended before that cancellation was recorded on the match row.
  const isCancelled = match.status === "cancelled" || (match.status === "pending" && locked);

  return (
    <Card
      className={
        match.status === "in_progress"
          ? "border-chart-4 bg-chart-4/5 ring-1 ring-chart-4"
          : isCancelled
            ? "opacity-60"
            : ""
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-semibold text-muted-foreground">Match {match.match_number}</span>
        {match.status === "pending" && !isCancelled && <Badge variant="outline">Pending</Badge>}
        {match.status === "in_progress" && (
          <Badge className="bg-chart-4 tabular-nums text-white">Live · {formatDuration(elapsed)}</Badge>
        )}
        {match.status === "completed" && (
          <Badge variant="secondary">
            Completed · {match.duration_seconds != null ? formatDuration(match.duration_seconds) : "—"}
          </Badge>
        )}
        {isCancelled && <Badge variant="outline">Cancelled</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div
            className={`space-y-2 rounded-lg border p-3 ${match.winner_team === 1 ? "border-primary bg-primary/5" : ""}`}
          >
            {match.winner_team === 1 && (
              <Trophy className="size-4 text-primary" aria-label="Winner" />
            )}
            <PlayerChip player={team1[0]} />
            <PlayerChip player={team1[1]} />
            {match.team1_score != null && (
              <p className="text-lg font-semibold tabular-nums">{match.team1_score}</p>
            )}
          </div>
          <span className="text-sm font-medium text-muted-foreground">vs</span>
          <div
            className={`space-y-2 rounded-lg border p-3 ${match.winner_team === 2 ? "border-primary bg-primary/5" : ""}`}
          >
            {match.winner_team === 2 && (
              <Trophy className="size-4 text-primary" aria-label="Winner" />
            )}
            <PlayerChip player={team2[0]} />
            <PlayerChip player={team2[1]} />
            {match.team2_score != null && (
              <p className="text-lg font-semibold tabular-nums">{match.team2_score}</p>
            )}
          </div>
        </div>

        {(match.started_at || match.ended_at) && (
          <p className="text-xs text-muted-foreground">
            {match.started_at && <>Started {formatTime(match.started_at)}</>}
            {match.ended_at && <> · Ended {formatTime(match.ended_at)}</>}
          </p>
        )}

        {sittingOut.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Sitting out: {sittingOut.map((p) => p.nickname || p.name).join(", ")}
          </p>
        )}

        {isCancelled && (
          <p className="text-sm text-muted-foreground">
            Not played — the game day ended before this match started.
          </p>
        )}

        {match.status === "pending" && !locked && isAdmin && (
          <Button onClick={handleStart} disabled={isPending} className="w-full">
            <Play className="size-4" />
            Start Match
          </Button>
        )}

        {match.status === "in_progress" && isAdmin && (
          <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
            <DialogTrigger render={<Button variant="secondary" className="w-full" />}>
              End Match
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enter the final score</DialogTitle>
                <DialogDescription>
                  The winner for match {match.match_number} is determined by whichever team scored higher.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`space-y-2 rounded-lg border p-3 ${leadingTeam === 1 ? "border-primary bg-primary/5" : ""}`}
                >
                  <Label htmlFor="team1_score">
                    {playerLabel(team1[0])} & {playerLabel(team1[1])}
                  </Label>
                  <Input
                    id="team1_score"
                    type="number"
                    min={0}
                    required
                    value={team1ScoreInput}
                    onChange={(e) => setTeam1ScoreInput(e.target.value)}
                  />
                </div>
                <div
                  className={`space-y-2 rounded-lg border p-3 ${leadingTeam === 2 ? "border-primary bg-primary/5" : ""}`}
                >
                  <Label htmlFor="team2_score">
                    {playerLabel(team2[0])} & {playerLabel(team2[1])}
                  </Label>
                  <Input
                    id="team2_score"
                    type="number"
                    min={0}
                    required
                    value={team2ScoreInput}
                    onChange={(e) => setTeam2ScoreInput(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleEnd} disabled={isPending}>
                  {isPending ? "Saving..." : "Save Result"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
