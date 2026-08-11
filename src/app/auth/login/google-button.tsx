"use client";

import { useMemo, useState } from "react";
import { LogIn } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function GoogleLoginButton() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    const { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
