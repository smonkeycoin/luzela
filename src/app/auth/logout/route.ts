import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  const target = new URL(request.url).searchParams.get("next") === "collab" ? "/collab/login" : "/auth/login";
  return NextResponse.redirect(`${origin}${target}`);
}

export async function POST(request: Request) {
  return GET(request);
}
