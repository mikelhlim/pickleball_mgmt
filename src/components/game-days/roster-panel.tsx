"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Users, X } from "lucide-react";
import {
  addAllPlayersToRoster,
  addPlayerToRoster,
  generateSchedule,
  registerAndAddPlayer,
  removePlayerFromRoster,
  type GenerateState,
  type RegisterPlayerState,
} from "@/app/(app)/game-days/[id]/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player } from "@/lib/types";

export function RosterPanel({
  gameDayId,
  roster,
  availablePlayers,
  canEdit,
  defaultNumMatches,
  hasMatches,
}: {
  gameDayId: string;
  roster: Player[];
  availablePlayers: Player[];
  canEdit: boolean;
  defaultNumMatches: number;
  hasMatches: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const registerAction = registerAndAddPlayer.bind(null, gameDayId);
  const [registerState, registerFormAction, registerPending] = useActionState<
    RegisterPlayerState,
    FormData
  >(registerAction, undefined);
  const registerFormRef = useRef<HTMLFormElement>(null);

  const generateAction = generateSchedule.bind(null, gameDayId);
  const [generateState, generateFormAction, generatePending] = useActionState<
    GenerateState,
    FormData
  >(generateAction, undefined);

  useEffect(() => {
    if (registerState?.error) toast.error(registerState.error);
    else if (registerState?.success) registerFormRef.current?.reset();
  }, [registerState]);

  useEffect(() => {
    if (generateState?.error) toast.error(generateState.error);
  }, [generateState]);

  function handleAdd(playerId: string | null) {
    if (!playerId) return;
    startTransition(async () => {
      try {
        await addPlayerToRoster(gameDayId, playerId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add player.");
      }
    });
  }

  function handleAddAll() {
    startTransition(async () => {
      try {
        await addAllPlayersToRoster(gameDayId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add all players.");
      }
    });
  }

  function handleRemove(playerId: string) {
    startTransition(async () => {
      try {
        await removePlayerFromRoster(gameDayId, playerId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove player.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster</CardTitle>
        <CardDescription>
          {canEdit
            ? "Add players, then generate the Order of Play. At least 4 players are required."
            : "Roster is locked once a match has started."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {roster.length === 0 && (
            <p className="text-sm text-muted-foreground">No players added yet.</p>
          )}
          {roster.map((player) => (
            <Badge key={player.id} variant="secondary" className="gap-1.5 py-1.5 pl-1 pr-1.5 text-sm">
              <Avatar className="size-5">
                <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
                <AvatarFallback className="text-[10px]">
                  {player.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {player.nickname || player.name}
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ${player.name}`}
                  onClick={() => handleRemove(player.id)}
                  disabled={isPending}
                  className="ml-0.5 rounded-full hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>

        {canEdit && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Add existing player</Label>
                <Select
                  key={roster.length}
                  onValueChange={handleAdd}
                  disabled={availablePlayers.length === 0 || isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        availablePlayers.length === 0 ? "All players added" : "Choose a player..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlayers.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                        {player.nickname ? ` (${player.nickname})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAll}
                disabled={availablePlayers.length === 0 || isPending}
              >
                <Users className="size-4" />
                Add All Players
              </Button>
            </div>

            <form ref={registerFormRef} action={registerFormAction} className="space-y-3">
              <Label className="text-sm font-medium">Register a new player</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input name="name" placeholder="Name" required />
                <Input name="nickname" placeholder="Nickname (optional)" />
                <Button type="submit" variant="outline" disabled={registerPending}>
                  <UserPlus className="size-4" />
                  {registerPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </form>

            <form action={generateFormAction} className="space-y-3 border-t pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="num_matches">Number of matches</Label>
                  <Input
                    id="num_matches"
                    name="num_matches"
                    type="number"
                    min={1}
                    required
                    defaultValue={defaultNumMatches}
                    className="w-32"
                  />
                </div>
                <Button type="submit" disabled={generatePending || roster.length < 4}>
                  {generatePending
                    ? "Generating..."
                    : hasMatches
                      ? "Regenerate Order of Play"
                      : "Generate Order of Play"}
                </Button>
              </div>
              {roster.length < 4 && (
                <p className="text-sm text-muted-foreground">
                  Add at least {4 - roster.length} more player{4 - roster.length === 1 ? "" : "s"} to
                  generate a schedule.
                </p>
              )}
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
