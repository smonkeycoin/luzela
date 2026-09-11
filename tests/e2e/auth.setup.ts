import { expect, test, type Browser, type Cookie } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const authDir = path.join(process.cwd(), "playwright", ".auth");
const adminStatePath = path.join(authDir, "admin.json");
const nonAdminStatePath = path.join(authDir, "non-admin.json");

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
  };
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required E2E auth configuration: ${name}. Configure it in .env.local or CI secrets.`,
    );
  }

  return value;
}

function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

function getStorageKey(supabaseUrl: string) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function chunkCookie(name: string, value: string) {
  const maxChunkSize = 3180;
  const encodedValue = encodeURIComponent(value);

  if (encodedValue.length <= maxChunkSize) {
    return [{ name, value }];
  }

  const chunks: string[] = [];
  let remaining = encodedValue;

  while (remaining.length > 0) {
    let encodedHead = remaining.slice(0, maxChunkSize);
    const lastEscapePos = encodedHead.lastIndexOf("%");

    if (lastEscapePos > maxChunkSize - 3) {
      encodedHead = encodedHead.slice(0, lastEscapePos);
    }

    let chunkValue = "";

    while (encodedHead.length > 0) {
      try {
        chunkValue = decodeURIComponent(encodedHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedHead.at(-3) === "%" &&
          encodedHead.length > 3
        ) {
          encodedHead = encodedHead.slice(0, encodedHead.length - 3);
          continue;
        }

        throw error;
      }
    }

    chunks.push(chunkValue);
    remaining = remaining.slice(encodedHead.length);
  }

  return chunks.map((chunkValue, index) => ({
    name: `${name}.${index}`,
    value: chunkValue,
  }));
}

async function signInWithPassword(email: string, password: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = getSupabaseAnonKey();

  if (!anonKey) {
    throw new Error(
      "Missing required E2E auth configuration: NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Supabase E2E password auth failed with HTTP ${response.status}.`);
  }

  const session = (await response.json()) as SupabaseSession;

  if (!session.access_token || !session.refresh_token || !session.user?.id) {
    throw new Error("Supabase E2E password auth returned an incomplete session.");
  }

  return {
    ...session,
    expires_at:
      session.expires_at ??
      Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  };
}

async function saveSupabaseStorageState({
  browser,
  email,
  password,
  outputPath,
}: {
  browser: Browser;
  email: string;
  password: string;
  outputPath: string;
}) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
  const cookieDomain = new URL(baseUrl).hostname;
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const storageKey = getStorageKey(supabaseUrl);
  const session = await signInWithPassword(email, password);
  const cookieValue = `base64-${toBase64Url(JSON.stringify(session))}`;
  const cookieChunks = chunkCookie(storageKey, cookieValue);
  const expires = session.expires_at || Math.floor(Date.now() / 1000) + 3600;
  const cookies: Cookie[] = cookieChunks.map((cookie) => ({
    ...cookie,
    domain: cookieDomain,
    path: "/",
    sameSite: "Lax",
    expires,
    httpOnly: false,
    secure: false,
  }));
  const context = await browser.newContext();

  await context.addCookies(cookies);
  await fs.mkdir(authDir, { recursive: true });
  await context.storageState({ path: outputPath });
  await context.close();
}

test("creates authenticated admin and non-admin storage states", async ({ browser }) => {
  await saveSupabaseStorageState({
    browser,
    email: requireEnv("E2E_ADMIN_EMAIL"),
    password: requireEnv("E2E_ADMIN_PASSWORD"),
    outputPath: adminStatePath,
  });

  const adminContext = await browser.newContext({ storageState: adminStatePath });
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/admin");
  await expect(adminPage).toHaveURL(/\/admin(?:\/)?$/);
  await expect(adminPage.getByText("Ventas hoy")).toBeVisible();
  await adminContext.close();

  await saveSupabaseStorageState({
    browser,
    email: requireEnv("E2E_NON_ADMIN_EMAIL"),
    password: requireEnv("E2E_NON_ADMIN_PASSWORD"),
    outputPath: nonAdminStatePath,
  });

  const nonAdminContext = await browser.newContext({ storageState: nonAdminStatePath });
  const nonAdminPage = await nonAdminContext.newPage();

  await nonAdminPage.goto("/admin");
  await expect(nonAdminPage).toHaveURL(/\/auth\/login/);
  await expect(nonAdminPage.getByRole("heading", { name: /Iniciar sesion/i })).toBeVisible();
  await nonAdminContext.close();
});
