import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(import.meta.dirname, "../.auth/admin.json");

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:7777";

/**
 * Runs once before any test project that depends on "setup".
 *
 * Strategy: call the backend login REST endpoint directly (no browser form),
 * inject the JWT tokens into localStorage via page.addInitScript, then navigate
 * to the dashboard to confirm auth is accepted. This avoids the TanStack Start
 * SSR hydration race where the native <form> GET submit fires before React's
 * onSubmit + e.preventDefault() can intercept it.
 */
setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set. " +
        "Copy .env.e2e.example to .env.e2e and fill in the values.",
    );
  }

  // Step 1: Obtain tokens from the backend REST API directly.
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login API failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    data?: { accessToken: string; refreshToken: string; expiredAt: number };
    message?: string;
  };

  if (!json.success || !json.data) {
    throw new Error(`Login API returned failure: ${json.message ?? JSON.stringify(json)}`);
  }

  const { accessToken, refreshToken, expiredAt } = json.data;

  // Step 2: Inject tokens into localStorage before any page script runs.
  await page.addInitScript(
    ({ at, rt, exp }) => {
      localStorage.setItem("access_token", at);
      localStorage.setItem("refresh_token", rt);
      localStorage.setItem("token_expiry", String(exp));
    },
    { at: accessToken, rt: refreshToken, exp: expiredAt },
  );

  // Step 3: Navigate to the dashboard — the app should accept the tokens
  // and render the authenticated view without redirecting to /login.
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 });

  // Step 4: Persist storage state (localStorage with the JWT) for all tests.
  await page.context().storageState({ path: authFile });
});
