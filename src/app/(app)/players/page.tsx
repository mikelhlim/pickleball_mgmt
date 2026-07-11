import { createClient } from "@/lib/supabase/server";
import { PlayerDialog } from "@/components/players/player-dialog";
import { PlayerCard } from "@/components/players/player-card";
import type { Player, PlayerStats } from "@/lib/types";

export default async function PlayersPage() {
  const supabase = await createClient();
  const [{ data: players }, { data: playerStats }] = await Promise.all([
    supabase.from("players").select("*").order("name"),
    supabase.from("player_stats").select("*"),
  ]);

  const statsById = new Map(((playerStats ?? []) as PlayerStats[]).map((s) => [s.player_id, s]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
          <p className="text-sm text-muted-foreground">Register and manage players.</p>
        </div>
        <PlayerDialog mode="create" />
      </div>

      {players && players.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(players as Player[]).map((player) => {
            const stats = statsById.get(player.id);
            return (
              <PlayerCard
                key={player.id}
                player={player}
                wins={stats?.wins ?? 0}
                losses={stats?.losses ?? 0}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No players yet. Add your first player to get started.
        </p>
      )}
    </div>
  );
}
