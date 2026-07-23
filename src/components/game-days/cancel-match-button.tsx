"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { cancelMatch } from "@/app/(app)/game-days/[id]/actions";
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

export function CancelMatchButton({
  matchId,
  gameDayId,
  label,
}: {
  matchId: string;
  gameDayId: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelMatch(matchId, gameDayId);
        toast.success(`${label} cancelled.`);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to cancel match.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Cancel ${label}`} />}>
        <Ban className="size-4 text-muted-foreground" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this match?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} won&apos;t be played and will be excluded from statistics. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={isPending}>
            {isPending ? "Cancelling..." : "Cancel Match"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
