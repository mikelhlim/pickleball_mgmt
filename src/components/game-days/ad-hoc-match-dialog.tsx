"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAdHocMatch } from "@/app/(app)/game-days/[id]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Player } from "@/lib/types";

const SLOTS = [
  { key: "team1_player1_id", label: "Team 1 — Player 1" },
  { key: "team1_player2_id", label: "Team 1 — Player 2" },
  { key: "team2_player1_id", label: "Team 2 — Player 1" },
  { key: "team2_player2_id", label: "Team 2 — Player 2" },
] as const;

const EMPTY_SELECTIONS = {
  team1_player1_id: "",
  team1_player2_id: "",
  team2_player1_id: "",
  team2_player2_id: "",
};

export function AdHocMatchDialog({ gameDayId, roster }: { gameDayId: string; roster: Player[] }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>(EMPTY_SELECTIONS);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (Object.values(selections).some((id) => !id)) {
      toast.error("Choose all 4 players.");
      return;
    }
    const formData = new FormData();
    for (const [key, value] of Object.entries(selections)) formData.set(key, value);

    startTransition(async () => {
      const result = await createAdHocMatch(gameDayId, undefined, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Match added.");
      setSelections(EMPTY_SELECTIONS);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelections(EMPTY_SELECTIONS);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" disabled={roster.length < 4} />}>
        <Plus className="size-4" />
        Add Match
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an Ad-Hoc Match</DialogTitle>
          <DialogDescription>
            Assign 4 roster players into two teams. The match is added as pending, ready to start.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {SLOTS.map((slot) => {
              const takenElsewhere = new Set(
                Object.entries(selections)
                  .filter(([key]) => key !== slot.key)
                  .map(([, value]) => value)
                  .filter(Boolean)
              );
              const options = roster.filter((p) => !takenElsewhere.has(p.id));
              return (
                <div key={slot.key} className="space-y-2">
                  <Label>{slot.label}</Label>
                  <Select
                    value={selections[slot.key]}
                    onValueChange={(v) => setSelections((prev) => ({ ...prev, [slot.key]: v ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a player...">
                        {(value: string | null) =>
                          roster.find((p) => p.id === value)?.name ?? "Choose a player..."
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name}
                          {player.nickname ? ` (${player.nickname})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Match"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
