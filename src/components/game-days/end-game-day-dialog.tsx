"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { endGameDay } from "@/app/(app)/game-days/[id]/actions";
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

export function EndGameDayDialog({ gameDayId }: { gameDayId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await endGameDay(gameDayId);
        toast.success("Game day ended.");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to end game day.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <CircleCheck className="size-4" />
        End Game Day
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this game day?</AlertDialogTitle>
          <AlertDialogDescription>
            Any matches that haven&apos;t been played will stay unplayed and won&apos;t count toward
            statistics. You can&apos;t generate or start matches for this game day afterward.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Ending..." : "End Game Day"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
