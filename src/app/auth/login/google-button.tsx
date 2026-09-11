"use client";

import { useMemo, useState } from "react";
import { LogIn } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function getAuthRedirectOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (
    process.env.NODE_ENV === "production" &&
    window.location.hostname.endsWith("luzela.mx")
  ) {
    return window.location.origin;
  }

  if (process.env.NODE_ENV === "production" && configuredOrigin) {
    return configuredOrigin;
  }

  return window.location.origin;
}

export function GoogleLoginButton({
  destination = "admin",
}: {
  destination?: "admin" | "collab";
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    // Routing hint only, never an access credential. Reuse the already authorized callback URL.
    document.cookie = `luzela_auth_destination=${destination}; Path=/; Max-Age=600; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    const { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getAuthRedirectOrigin()}/auth/callback`,
      },
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[var(--ink)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn size={18} aria-hidden />
        {loading ? "Conectando..." : "Continuar con Google"}
      </button>
      {error ? (
        <p className="text-sm font-semibold text-[var(--coral)]">{error}</p>
      ) : null}
    </div>
  );
}
