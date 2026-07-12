"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { createVenue, updateVenue } from "@/app/(app)/venues/actions";
import { Button } from "@/components/ui/button";
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
import type { Venue } from "@/lib/types";

export function VenueDialog({ mode, venue }: { mode: "create" | "edit"; venue?: Venue }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result =
        mode === "create" ? await createVenue(undefined, formData) : await updateVenue(undefined, formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Venue added." : "Venue updated.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" />
          Add Venue
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Edit ${venue?.name}`} />}>
          <Pencil className="size-4" />
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Venue" : "Edit Venue"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Register a new game venue." : "Update this venue's name."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "edit" && venue && <input type="hidden" name="id" value={venue.id} />}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input key={venue?.name} id="name" name="name" defaultValue={venue?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              key={venue?.location}
              id="location"
              name="location"
              placeholder="Address or area (optional)"
              defaultValue={venue?.location ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_number">Contact number</Label>
            <Input
              key={venue?.contact_number}
              id="contact_number"
              name="contact_number"
              type="tel"
              placeholder="Optional"
              defaultValue={venue?.contact_number ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Website</Label>
            <Input
              key={venue?.url}
              id="url"
              name="url"
              type="text"
              inputMode="url"
              placeholder="Optional — e.g. example.com"
              defaultValue={venue?.url ?? ""}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
