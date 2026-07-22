import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth-role";
import { PlayerDialog } from "@/components/players/player-dialog";
import { PlayerCard } from "@/components/players/player-card";
import type { Player } from "@/lib/types";

export default async function PlayersPage() {
  const supabase = await createClient();
  const [{ data: players }, role] = await Promise.all([
    supabase.from("players").select("*").order("name"),
    getCurrentRole(supabase),
  ]);
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-sm text-muted-foreground">Register and manage players.</p>
        </div>
        {isAdmin && <PlayerDialog mode="create" />}
      </div>

      {players && players.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(players as Player[]).map((player) => {
            // Email and phone are personal contact details — only admins see
            // them. Redacting here (rather than just hiding in the UI) keeps
            // the values out of the page's data entirely for a viewer.
            const visiblePlayer = isAdmin ? player : { ...player, email: null, phone: null };
            return <PlayerCard key={player.id} player={visiblePlayer} isAdmin={isAdmin} />;
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
