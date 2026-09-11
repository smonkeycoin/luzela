import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function loadDotEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvLocal();

const adminStorageState = "playwright/.auth/admin.json";
const nonAdminStorageState = "playwright/.auth/non-admin.json";
const hasMercadoPagoSmoke = Boolean(process.env.E2E_MERCADOPAGO_CHECKOUT_SESSION_ID);

const projects = [
  {
    name: "setup",
    testMatch: /.*auth\.setup\.ts/,
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "public",
    testIgnore: [
      /.*auth\.setup\.ts/,
      /.*admin-attribution\.spec\.ts/,
      /.*admin-dashboard\.spec\.ts/,
      /.*admin-shipping\.spec\.ts/,
      /.*admin-authorization\.spec\.ts/,
      /.*admin-mobile\.spec\.ts/,
      /.*mercadopago-payment\.spec\.ts/,
    ],
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "admin-authenticated",
    dependencies: ["setup"],
    testMatch: /.*admin-(attribution|dashboard|shipping)\.spec\.ts/,
    use: { ...devices["Desktop Chrome"], storageState: adminStorageState },
  },
  {
    name: "admin-non-admin",
    dependencies: ["setup"],
    testMatch: /.*admin-authorization\.spec\.ts/,
    use: { ...devices["Desktop Chrome"], storageState: nonAdminStorageState },
  },
  {
    name: "mobile-admin",
    dependencies: ["setup"],
    testMatch: /.*admin-mobile\.spec\.ts/,
    use: { ...devices["Pixel 5"], storageState: adminStorageState },
  },
];

if (hasMercadoPagoSmoke) {
  projects.push({
    name: "mercadopago-smoke",
    testMatch: /.*mercadopago-payment\.spec\.ts/,
    use: { ...devices["Desktop Chrome"] },
  });
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  projects,
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
