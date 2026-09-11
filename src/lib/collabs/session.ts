import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function requireCollabSession() {
  const db = await createSupabaseServerClient();
  if (!db) redirect("/collab/login");
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/collab/login");
  const { data: collaborators, error: accessError } = await db
    .from("collaborators")
    .select("id,slug,display_name,brand_name,campaign_code,status")
    .eq("status", "active");
  if (accessError || !collaborators?.length)
    redirect("/collab/login?error=access");
  // RLS can also return rows for admins; the partner portal requires explicit membership.
  const permitted = [];
  for (const c of collaborators) {
    const { data } = await db.rpc("collab_has_access", { target: c.id });
    if (data) permitted.push(c);
  }
  if (!permitted.length) redirect("/collab/login?error=access");
  return { db, user, collaborators: permitted };
}
