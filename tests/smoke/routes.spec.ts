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

/**
 * The JSX whitespace hazard: a closing inline tag followed by a space and
 * then text that wraps to the next source line silently loses the space, so
 * `<strong>Overlap.</strong> If two…` renders as `Overlap.If two…`. The
 * source looks right, so this can only be caught in the rendered output. It
 * shipped fourteen times into live articles before anyone noticed (#136).
 */
const LESSON_ROUTES = MODULES.filter(
  (m) => m.status === "ready" && m.href.startsWith("/learn/"),
).map((m) => m.href);

for (const route of LESSON_ROUTES) {
  test(`${route} keeps its spaces around inline tags`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    const html = await page.locator("article").first().innerHTML();
    const missing: string[] = [];
    // Text glued to an inline tag on either side, e.g. `…rule.</strong>If` or `word<em>`.
    for (const m of html.matchAll(/(<\/(?:strong|em)>)([A-Za-z])/g)) {
      missing.push(html.slice(Math.max(0, m.index! - 40), m.index! + 20));
    }
    for (const m of html.matchAll(/([A-Za-z,.;:])(<(?:strong|em)[\s>])/g)) {
      missing.push(html.slice(Math.max(0, m.index! - 30), m.index! + 30));
    }
    expect(
      missing,
      `${route}: text glued to an inline tag — add {" "} at the boundary:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
}

/**
 * Design mode has more than one seeded set. Switching sets must keep the
 * scores already given on each — twenty clicks is too much to lose to a
 * mis-click — and a set's title, brief, and prompt must follow the picker.
 */
test("/play/evals design mode switches sets and keeps each set's scores", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/evals", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Design a rubric" }).click();
  await expect(page.getByText("The set — Expired card at checkout")).toBeVisible();
  const picker = page.getByRole("group", { name: "Set" });
  await expect(picker.getByRole("button", { name: "Expired card at checkout" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await picker.getByRole("button", { name: "Delivery by Friday?" }).click();
  await expect(page.getByText("The set — Delivery by Friday?")).toBeVisible();
  await expect(page.getByText("Will my order get here by Friday?")).toBeVisible();

  // One score on the second set's first output, then away and back.
  await page.getByRole("button", { name: "Clarity: Excels" }).first().click();
  await expect(page.getByText("1/5 scored")).toBeVisible();
  await picker.getByRole("button", { name: "Expired card at checkout" }).click();
  await expect(page.getByText("The set — Expired card at checkout")).toBeVisible();
  await expect(page.getByText("1/5 scored")).toHaveCount(0);
  await picker.getByRole("button", { name: "Delivery by Friday?" }).click();
  await expect(page.getByText("1/5 scored")).toBeVisible();

  expect(errors).toEqual([]);
});

/**
 * The reader's own set needs a key to write anything, but the panel that
 * asks for the brief and the writer must render without one, with the
 * write button held until a key is present.
 */
test("/play/evals design mode offers the reader's own set without a key", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/evals", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Design a rubric" }).click();
  await page.getByRole("group", { name: "Set" }).getByRole("button", { name: "Your own" }).click();
  await expect(page.getByText("The set — your own")).toBeVisible();
  await expect(page.getByLabel("The surface")).toBeVisible();
  await expect(page.getByLabel("The request")).toBeVisible();
  // The writer defaults to whatever needs no key; a keyed provider without a key holds the button.
  await page.getByLabel("Writer provider").selectOption("anthropic");
  await expect(page.getByText("No key", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Write 4 replies/ })).toBeDisabled();
  expect(errors).toEqual([]);
});
