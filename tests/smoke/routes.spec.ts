import { test, expect, type ConsoleMessage } from "@playwright/test";
import { MODULES } from "../../lib/curriculum";
import { PLAYGROUNDS } from "../../lib/playgrounds";

/**
 * A build that succeeds still says nothing about whether a page runs: a bad
 * hook order, a client component reading `window` at module scope, or a null
 * deref in a report component all compile cleanly and blow up on load.
 *
 * Routes are enumerated from the same registries the site itself uses, so a
 * new lesson or playground is covered the moment it is registered.
 */
const ROUTES = [
  "/",
  "/learn",
  "/play",
  "/start",
  "/notebook",
  "/settings/keys",
  ...MODULES.filter((m) => m.status === "ready" && m.href.startsWith("/learn/")).map(
    (m) => m.href,
  ),
  ...PLAYGROUNDS.filter((p) => p.status === "ready").map((p) => p.href),
];

/**
 * Noise we do not want to fail a build over. WebGPU is absent in headless
 * Chromium, so the in-browser model path reports it on every page, and the
 * analytics script only exists when Vercel is serving.
 */
const IGNORED_CONSOLE = [/webgpu/i, /gpu is not supported/i];
const IGNORED_REQUESTS = [/_vercel\/insights/, /favicon/];

/**
 * Resource failures are checked by URL rather than by console text: Chromium
 * reports them as a bare "Failed to load resource", which carries no way to
 * tell the analytics script from a missing bundle.
 */
const isRealConsoleError = (m: ConsoleMessage) =>
  m.type() === "error" &&
  !/Failed to load resource/i.test(m.text()) &&
  !IGNORED_CONSOLE.some((re) => re.test(m.text()));

for (const route of ROUTES) {
  test(`${route} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (isRealConsoleError(m)) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", (r) => {
      if (r.status() < 400) return;
      if (IGNORED_REQUESTS.some((re) => re.test(r.url()))) return;
      errors.push(`${r.status()} ${r.url()}`);
    });

    // networkidle, not domcontentloaded: a resource that 404s after first paint
    // otherwise lands after the assertion and fails a different route at random.
    const res = await page.goto(route, { waitUntil: "networkidle" });
    expect(res?.status(), `${route} returned ${res?.status()}`).toBe(200);

    // Next renders its error overlay/boundary as real markup, so a 200 alone
    // is not proof the page worked.
    await expect(page.locator("body")).not.toContainText(
      "Application error: a client-side exception",
    );
    await expect(page.locator("h1, h2").first()).toBeVisible();

    expect(errors, `errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("the primary nav is a navigation landmark and reaches every section", async ({ page }) => {
  await page.goto("/learn");
  // Landmark, not just a list of links: the desktop nav lived in a bare <aside>
  // until this test went looking for it by role.
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  for (const label of ["Home", "Learn", "Play", "Notebook"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
});

test("nav labels carry no section numbers", async ({ page }) => {
  await page.goto("/learn");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav.getByRole("link", { name: "Learn" })).toHaveText("Learn");
});
