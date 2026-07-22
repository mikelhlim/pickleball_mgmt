"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Trash2, Users, X } from "lucide-react";
import {
  createScheduledSession,
  deleteScheduledSession,
  updateScheduledSession,
} from "@/app/(app)/schedule/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import type { Player, ScheduledGameDay, Venue } from "@/lib/types";

export type ScheduledSessionWithRoster = ScheduledGameDay & { playerIds: string[] };

export function ScheduledSessionDialog({
  open,
  onOpenChange,
  date,
  session,
  venues,
  players,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  session?: ScheduledSessionWithRoster;
  venues: Venue[];
  players: Player[];
}) {
  const [isPending, startTransition] = useTransition();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [sessionDate, setSessionDate] = useState(session?.session_date ?? date);
  const [sessionTime, setSessionTime] = useState(session?.session_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(session?.end_time?.slice(0, 5) ?? "");
  const [courtNumber, setCourtNumber] = useState(
    session?.court_number != null ? String(session.court_number) : ""
  );
  const [venueId, setVenueId] = useState(session?.venue_id ?? "");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(session?.playerIds ?? []);

  const playersById = new Map(players.map((p) => [p.id, p]));
  const availablePlayers = players.filter((p) => !selectedPlayerIds.includes(p.id));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (session) formData.set("id", session.id);
    formData.set("session_date", sessionDate);
    formData.set("session_time", sessionTime);
    formData.set("end_time", endTime);
    formData.set("court_number", courtNumber);
    formData.set("venue_id", venueId);
    formData.delete("player_ids");
    for (const id of selectedPlayerIds) formData.append("player_ids", id);

    startTransition(async () => {
      const result = session
        ? await updateScheduledSession(undefined, formData)
        : await createScheduledSession(undefined, formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(session ? "Session updated." : "Session scheduled.");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!session) return;
    startTransition(async () => {
      try {
        await deleteScheduledSession(session.id);
        toast.success("Session cancelled.");
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to cancel session.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session ? "Scheduled Session" : "Schedule a Game Day"}</DialogTitle>
          <DialogDescription>
            {session
              ? "Update the plan for this session, or cancel it."
              : `Plan a session for ${format(parseISO(date), "EEEE, MMMM d, yyyy")}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session_date">Date</Label>
              <Input
                id="session_date"
                type="date"
                min={todayStr}
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value < todayStr ? todayStr : e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_time">Time</Label>
              <Input
                id="session_time"
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                min={sessionTime}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="court_number">Court Number</Label>
              <Input
                id="court_number"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 3"
                value={courtNumber}
                onChange={(e) => setCourtNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Venue</Label>
            <Select value={venueId} onValueChange={(v) => setVenueId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No venue selected">
                  {(value: string | null) => venues.find((v) => v.id === value)?.name ?? "No venue selected"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Players</Label>
            <div className="flex flex-wrap gap-2">
              {selectedPlayerIds.length === 0 && (
                <p className="text-sm text-muted-foreground">No players added yet.</p>
              )}
              {selectedPlayerIds.map((id) => {
                const player = playersById.get(id);
                if (!player) return null;
                return (
                  <Badge key={id} variant="secondary" className="gap-1.5 py-1.5 pr-1.5 pl-1 text-sm">
                    <Avatar className="size-5">
                      <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
                      <AvatarFallback className="text-[10px]">
                        {player.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {player.nickname || player.name}
                    <button
                      type="button"
                      aria-label={`Remove ${player.name}`}
                      onClick={() => setSelectedPlayerIds((prev) => prev.filter((pid) => pid !== id))}
                      className="ml-0.5 rounded-full hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                key={selectedPlayerIds.length}
                onValueChange={(v: string | null) => {
                  if (v) setSelectedPlayerIds((prev) => [...prev, v]);
                }}
                disabled={availablePlayers.length === 0}
              >
                <SelectTrigger className="w-full flex-1">
                  <SelectValue
                    placeholder={availablePlayers.length === 0 ? "All players added" : "Add a player..."}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedPlayerIds(players.map((p) => p.id))}
                disabled={availablePlayers.length === 0}
              >
                <Users className="size-4" />
                Add All Players
              </Button>
            </div>
          </div>

          <DialogFooter className={session ? "sm:justify-between" : undefined}>
            {session && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
                <Trash2 className="size-4" />
                Cancel Session
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
