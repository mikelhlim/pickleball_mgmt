"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createAppUser, type CreateUserState } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddUserForm() {
  const [state, formAction, pending] = useActionState<CreateUserState, FormData>(
    createAppUser,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success) {
      toast.success("User added. Share the email and temporary password (123456) with them.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="new-user-email">Email</Label>
        <Input id="new-user-email" name="email" type="email" placeholder="name@example.com" required />
      </div>
      <Button type="submit" disabled={pending}>
        <UserPlus className="size-4" />
        {pending ? "Adding..." : "Add User"}
      </Button>
    </form>
  );
}
