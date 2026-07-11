"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deletePlayer } from "@/app/(app)/players/actions";
import { PlayerDialog } from "./player-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Player } from "@/lib/types";

export function PlayerCard({
  player,
  wins = 0,
  losses = 0,
}: {
  player: Player;
  wins?: number;
  losses?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePlayer(player.id);
        toast.success(`${player.name} removed.`);
        setConfirmOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete player.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Link href={`/players/${player.id}`} className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar className="size-12">
            <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
            <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium hover:underline">{player.name}</p>
            {player.nickname && (
              <p className="truncate text-sm text-muted-foreground">&ldquo;{player.nickname}&rdquo;</p>
            )}
            {wins + losses > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {wins}W – {losses}L
              </p>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <PlayerDialog mode="edit" player={player} />
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Delete ${player.name}`} />}>
              <Trash2 className="size-4 text-destructive" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {player.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the player. Past match records that included them will keep
                  their other players but lose this player&apos;s slot.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                  {isPending ? "Removing..." : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
