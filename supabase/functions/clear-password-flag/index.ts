// Supabase Edge Function used by the iOS app after a signed-in user sets a
// new password to replace a temporary one.
//
// The web app's updateOwnPassword (src/lib/actions/auth.ts) clears the
// caller's own `must_change_password` app_metadata flag via a service-role
// admin client — app_metadata isn't self-editable through the normal
// `auth.updateUser` call. A mobile app binary can't hold the service-role
// key, so this function holds it server-side instead, verifies the
// caller's JWT (Edge Functions do this by default), and only ever clears
// the flag for that same verified user id — never an id supplied by the
// client.
//
// One-time setup (from the pickleball-app directory, with the Supabase CLI
// installed and linked to your project):
//   supabase functions deploy clear-password-flag
//   (SUPABASE_SERVICE_ROLE_KEY is already available to all Edge Functions
//   automatically — no separate secret needed.)

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization." }, 401);

  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "Not signed in." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  });
  if (error) return json({ error: error.message }, 500);

  return json({ success: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
