"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { sendScheduleReminder } from "@/app/(app)/schedule/actions";
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

export function SendReminderButton({
  sessionId,
  label,
  recipientCount,
}: {
  sessionId: string;
  label: string;
  recipientCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSend() {
    startTransition(async () => {
      try {
        const { sentCount, skippedCount, failedCount } = await sendScheduleReminder(sessionId);
        const notes = [
          skippedCount > 0 ? `${skippedCount} had no email on file` : null,
          failedCount > 0 ? `${failedCount} failed to deliver` : null,
        ].filter(Boolean);
        toast.success(
          `Reminder sent to ${sentCount} player${sentCount === 1 ? "" : "s"}.` +
            (notes.length > 0 ? ` ${notes.join(", ")}.` : "")
        );
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to send reminder.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Send email reminder for ${label}`}
            disabled={recipientCount === 0}
            title={recipientCount === 0 ? "No players with an email on file" : undefined}
          />
        }
      >
        <Mail className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send email reminder?</AlertDialogTitle>
          <AlertDialogDescription>
            Sends a reminder email for {label} to {recipientCount} player
            {recipientCount === 1 ? "" : "s"} on the roster with an email on file.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={isPending}>
            {isPending ? "Sending..." : "Send Reminder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
