"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Trash2 } from "lucide-react";
import { deleteVenue } from "@/app/(app)/venues/actions";
import { VenueDialog } from "./venue-dialog";
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
import type { Venue } from "@/lib/types";

export function VenueCard({ venue, isAdmin = false }: { venue: Venue; isAdmin?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteVenue(venue.id);
        toast.success(`${venue.name} removed.`);
        setConfirmOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete venue.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <MapPin className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{venue.name}</p>
          {venue.location && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {venue.location}
            </p>
          )}
          {venue.contact_number && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Phone className="size-3 shrink-0" />
              {venue.contact_number}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <VenueDialog mode="edit" venue={venue} />
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Delete ${venue.name}`} />}>
                <Trash2 className="size-4 text-destructive" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {venue.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Game days that used this venue will keep their other details but lose this venue
                    reference.
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
        )}
      </CardContent>
    </Card>
  );
}
