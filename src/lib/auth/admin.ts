import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminRole = "owner" | "admin" | "operations" | "readonly";

export type AdminSession = {
  user: {
    id: string;
    email?: string;
  };
  admin: {
    role: AdminRole;
    email: string;
  };
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("email, role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !adminUser) {
    await supabase.auth.signOut();
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    admin: {
      email: adminUser.email,
      role: adminUser.role as AdminRole,
    },
  };
}

export async function requireAdminSession() {
  const adminSession = await getAdminSession();

  if (!adminSession) {
    redirect("/auth/login");
  }

  return adminSession;
}
