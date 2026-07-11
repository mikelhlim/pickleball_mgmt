"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createGameDay, type GameDayFormState } from "@/app/(app)/game-days/actions";
import { createVenue } from "@/app/(app)/venues/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Venue } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function NewGameDayDialog({ venues }: { venues: Venue[] }) {
  const [state, formAction, pending] = useActionState<GameDayFormState, FormData>(
    createGameDay,
    undefined
  );
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState("");
  const [pendingVenue, setPendingVenue] = useState<{ id: string; name: string } | null>(null);
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [isCreatingVenue, startCreatingVenue] = useTransition();

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const allVenues =
    pendingVenue && !venues.some((v) => v.id === pendingVenue.id) ? [...venues, pendingVenue] : venues;

  function handleAddVenue() {
    if (!newVenueName.trim()) return;
    const formData = new FormData();
    formData.set("name", newVenueName.trim());

    startCreatingVenue(async () => {
      const result = await createVenue(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.venue) {
        setPendingVenue(result.venue);
        setVenueId(result.venue.id);
      }
      setNewVenueName("");
      setAddingVenue(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        New Game Day
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Game Day</DialogTitle>
          <DialogDescription>Set the date and how many matches you&apos;ll play.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="venue_id" value={venueId} />
          <div className="space-y-2">
            <Label htmlFor="session_date">Date</Label>
            <Input id="session_date" name="session_date" type="date" defaultValue={today()} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="num_matches">Number of matches</Label>
            <Input id="num_matches" name="num_matches" type="number" min={1} defaultValue={12} required />
          </div>
          <div className="space-y-2">
            <Label>Venue</Label>
            <Select value={venueId} onValueChange={(v) => setVenueId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No venue selected">
                  {(value: string | null) =>
                    allVenues.find((v) => v.id === value)?.name ?? "No venue selected"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allVenues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {addingVenue ? (
              <div className="flex gap-2">
                <Input
                  placeholder="New venue name"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  autoFocus
                />
                <Button type="button" variant="outline" disabled={isCreatingVenue} onClick={handleAddVenue}>
                  {isCreatingVenue ? "Adding..." : "Add"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAddingVenue(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingVenue(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                + Add new venue
              </button>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
