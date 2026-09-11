import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey } from "@/lib/env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookies";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  function redirectNoStore(path: string) {
    const response = NextResponse.redirect(`${origin}${path}`, 303);

    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.redirect(`${origin}/auth/login?error=supabase_env`);
  }

  const cookieStore = await cookies();
  const collabDestination =
    requestUrl.searchParams.get("next") === "collab" ||
    cookieStore.get("luzela_auth_destination")?.value === "collab";
  cookieStore.set("luzela_auth_destination", "", { path: "/", maxAge: 0 });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (exchangeError) {
    return redirectNoStore("/auth/login?error=callback_exchange");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await supabase.auth.signOut();
    return redirectNoStore("/auth/login?error=no_user");
  }

  if (collabDestination) {
    const { data: accepted, error } = await supabase.rpc(
      "accept_collab_membership",
    );
    if (error || !accepted) {
      await supabase.auth.signOut();
      return redirectNoStore("/collab/login?error=access");
    }
    return redirectNoStore("/collab");
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("id, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !adminUser) {
    await supabase.auth.signOut();
    return redirectNoStore("/auth/access-denied");
  }

  return redirectNoStore("/admin");
}
