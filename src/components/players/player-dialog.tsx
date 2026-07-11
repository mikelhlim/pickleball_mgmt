"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Pencil, Plus } from "lucide-react";
import { createPlayer, updatePlayer } from "@/app/(app)/players/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function PlayerDialog({ mode, player }: { mode: "create" | "edit"; player?: Player }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(player?.photo_url ?? null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result =
        mode === "create" ? await createPlayer(undefined, formData) : await updatePlayer(undefined, formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Player added." : "Player updated.");
      setOpen(false);
      if (mode === "create") {
        formRef.current?.reset();
        setPreview(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" />
          Add Player
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Edit ${player?.name}`} />}>
          <Pencil className="size-4" />
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Player" : "Edit Player"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Register a new player." : "Update this player's details."}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {mode === "edit" && player && <input type="hidden" name="id" value={player.id} />}
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={preview ?? undefined} alt="Player photo preview" />
              <AvatarFallback>
                <Camera className="size-6 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <Label
                htmlFor={`photo-${mode}-${player?.id ?? "new"}`}
                className="cursor-pointer text-sm font-medium text-primary"
              >
                {preview ? "Change photo" : "Add photo"}
              </Label>
              <Input
                id={`photo-${mode}-${player?.id ?? "new"}`}
                name="photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPreview(URL.createObjectURL(file));
                }}
              />
              <p className="text-xs text-muted-foreground">Take a photo or choose one from your device.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input key={player?.name} id="name" name="name" defaultValue={player?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              key={player?.nickname}
              id="nickname"
              name="nickname"
              defaultValue={player?.nickname ?? ""}
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
