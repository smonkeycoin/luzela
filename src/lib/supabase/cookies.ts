export function getSupabaseCookieOptions() {
  if (process.env.NODE_ENV === "production") {
    return {
      domain: ".luzela.mx",
      path: "/",
      sameSite: "lax" as const,
      secure: true,
    };
  }

  return {
    path: "/",
    sameSite: "lax" as const,
  };
}
