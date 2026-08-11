import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(`${origin}/auth/login?error=supabase_env`);
  }

  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/auth/login?error=callback_exchange`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/login?error=no_user`);
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("id, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !adminUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/access-denied`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
