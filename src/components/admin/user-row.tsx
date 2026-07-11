"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { deleteAppUser, resetUserPassword, type AppUserSummary } from "@/app/(app)/admin/actions";
import { Badge } from "@/components/ui/badge";
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

export function UserRow({ user, isCurrentUser }: { user: AppUserSummary; isCurrentUser: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleReset() {
    startTransition(async () => {
      try {
        await resetUserPassword(user.id);
        toast.success("Password reset to 123456 — they'll be asked to change it on next sign-in.");
        setResetOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to reset password.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteAppUser(user.id);
        toast.success(`${user.email} removed.`);
        setDeleteOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete user.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          Added {format(new Date(user.createdAt), "MMM d, yyyy")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {user.mustChangePassword && <Badge variant="outline">Pending password change</Badge>}

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Reset password for ${user.email}`}
                disabled={isCurrentUser}
              />
            }
          >
            <KeyRound className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset password for {user.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                Their password will be reset to the temporary password <strong>123456</strong>, and
                they&apos;ll be required to set a new one the next time they sign in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={isPending}>
                {isPending ? "Resetting..." : "Reset Password"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${user.email}`}
                disabled={isCurrentUser}
              />
            }
          >
            <Trash2 className="size-4 text-destructive" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {user.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes their account. They will no longer be able to sign in. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? "Deleting..." : "Delete User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
