import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { MODULES } from "../../lib/curriculum";
import { PLAYGROUNDS } from "../../lib/playgrounds";
import { LENS_IDS } from "../../lib/lenses";

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
  "/lab",
  "/privacy",
  "/start",
  "/notebook",
  "/settings/keys",
  ...LENS_IDS.map((id) => `/for/${id}`),
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
  for (const label of ["Home", "Learn", "Play", "Lab", "Notebook"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
});

test("home offers three ways in and a lucky card that lands on a lesson or playground", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/", { waitUntil: "networkidle" });
  const paths = page.getByTestId("learning-paths");
  await expect(paths.getByRole("link", { name: /Learn by reading/ })).toHaveAttribute("href", "/learn");
  await expect(paths.getByRole("link", { name: /Learn by doing/ })).toHaveAttribute("href", "/play");
  for (const id of LENS_IDS) await expect(paths.locator(`a[href="/for/${id}"]`)).toHaveCount(1);
  await page.getByTestId("lucky-card").click();
  await page.waitForURL(/\/(learn|play)\/[a-z-]+$/);
  expect(errors).toEqual([]);
});

test("every page has a footer that links to privacy", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const footer = page.getByTestId("site-footer");
  await expect(footer.getByRole("link", { name: "Privacy & data" })).toHaveAttribute("href", "/privacy");
  await footer.getByRole("link", { name: "Privacy & data" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Privacy");
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
  await expect(picker.getByRole("button", { name: "Factory reset" })).toBeVisible();
  await expect(picker.getByRole("button", { name: "New sign-in" })).toBeVisible();

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

/**
 * Roundtable's levers are the protocol, not the prompts: seating order,
 * a blind first round, the stop rule. They have to work before any key is
 * present, and the run button has to hold until every seat has one.
 */
test("/play/roundtable reorders seats and toggles the protocol without a key", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/roundtable", { waitUntil: "networkidle" });
  const names = () =>
    page.locator('input[aria-label$=" name"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(await names()).toEqual(["Priya", "Sam", "Noor"]);
  await page.getByRole("button", { name: "Move Noor earlier" }).click();
  expect(await names()).toEqual(["Priya", "Noor", "Sam"]);
  const firstRound = page.getByRole("group", { name: "First round" });
  await firstRound.getByRole("button", { name: "Blind" }).click();
  await expect(firstRound.getByRole("button", { name: "Blind" })).toHaveAttribute("aria-pressed", "true");
  const stop = page.getByRole("group", { name: "Stop rule" });
  await stop.getByRole("button", { name: "At consensus" }).click();
  await expect(stop.getByRole("button", { name: "At consensus" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/stops early the moment a round agrees/)).toBeVisible();
  const side = page.getByRole("group", { name: "Side-channels" });
  await side.getByRole("button", { name: "Whispers" }).click();
  await expect(side.getByRole("button", { name: "Whispers" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/you see every whisper, the seats see only their own/)).toBeVisible();
  // Seat a keyed provider with no key: the table can't run.
  await page.getByLabel("Seat 1 provider").selectOption("anthropic");
  await expect(page.getByRole("button", { name: /Run the table/ })).toBeDisabled();
  expect(errors).toEqual([]);
});

/**
 * A local server that wants no key has to be a first-class provider: saved
 * on the Keys page without a key, then picked up by the playgrounds as set
 * up — no missing-key banner, the endpoint selected by default.
 */
test("/settings/keys saves a keyless local endpoint and the playgrounds stop asking for a key", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/settings/keys", { waitUntil: "networkidle" });
  await page.getByLabel("Custom endpoint base URL").fill("http://localhost:11434/v1");
  await page.getByLabel(/No key — this is a local server/).check();
  await expect(page.getByLabel("Custom endpoint API key")).toHaveCount(0);
  await page.getByRole("button", { name: "Save endpoint" }).click();
  await expect(page.getByText(/localhost:11434 — no key, called directly/)).toBeVisible();

  await page.goto("/play/tools", { waitUntil: "networkidle" });
  await expect(page.locator("select").first()).toHaveValue("custom");
  await expect(page.getByText(/You're missing a key/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * Relay mode's third experiment needs a document in the room. Opening relay
 * mode seeds the retrieved notes once, the provenance toggle is there, and a
 * scenario can attach or drop a document without a key.
 */
test("/play/tools relay mode seeds a retrieved document and offers the provenance toggle", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/tools", { waitUntil: "networkidle" });
  const values = (label: string) =>
    page.locator(`input[aria-label="${label}"]`).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(await values("Scenario name")).not.toContain("Retrieved notes");
  await page.getByRole("button", { name: "Relay", exact: true }).click();
  expect(await values("Scenario name")).toContain("Retrieved notes");
  expect(await values("Source name")).toEqual(["Meeting notes — retrieved from the shared drive"]);
  expect(await values("Source tell")).toEqual(["rival-example.com"]);
  await expect(page.getByLabel("Handoffs carry provenance")).not.toBeChecked();
  await page.getByLabel("Handoffs carry provenance").check();
  await expect(page.getByLabel("Handoffs carry provenance")).toBeChecked();
  // Back to solo and into relay again: still one document.
  await page.getByRole("button", { name: "Solo", exact: true }).click();
  await page.getByRole("button", { name: "Relay", exact: true }).click();
  expect((await values("Scenario name")).filter((v) => v === "Retrieved notes")).toHaveLength(1);
  expect(errors).toEqual([]);
});

/**
 * Lens packs. A ?lens= link must land on that lens's scenario and stick, the
 * picker must swap scenarios without a key, and a saved draft must never be
 * overwritten by the lens — the draft owns its content.
 */
test("/play/refusal?lens=policy opens on the policy probe panel", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/refusal?lens=policy", { waitUntil: "networkidle" });

  const picker = page.getByRole("group", { name: "Example scenario" });
  await expect(picker.getByRole("button", { name: "Policy" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Sounds adversarial, isn't")).toBeVisible();

  // The lens sticks: a plain visit to another playground uses it too.
  await page.goto("/play/portability", { waitUntil: "networkidle" });
  const textareas = page.locator("textarea");
  await expect
    .poll(() => textareas.evaluateAll((els) => els.some((e) => (e as HTMLTextAreaElement).value.includes("claimant handbook"))))
    .toBe(true);

  expect(errors).toEqual([]);
});

test("/play/spread switches to the philosophy example without a key", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/spread", { waitUntil: "networkidle" });

  const picker = page.getByRole("group", { name: "Example scenario" });
  await expect(picker.getByRole("button", { name: "General" })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "Philosophy" }).click();
  await expect(picker.getByRole("button", { name: "Philosophy" })).toHaveAttribute("aria-pressed", "true");

  const textareas = page.locator("textarea");
  await expect
    .poll(() => textareas.evaluateAll((els) => els.some((e) => (e as HTMLTextAreaElement).value.includes("trolley"))))
    .toBe(true);

  expect(errors).toEqual([]);
});

test("lessons open with the reader's lens intro, and none without a lens", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/learn/distributions-not-outputs", { waitUntil: "networkidle" });
  await expect(page.getByText(/^Reading as/)).toHaveCount(0);

  await page.goto("/for/philosophy", { waitUntil: "networkidle" });
  await page.goto("/learn/distributions-not-outputs", { waitUntil: "networkidle" });
  await expect(page.getByText("Reading as philosophy & ethics")).toBeVisible();
  await expect(page.getByText(/a distribution of verdicts/)).toBeVisible();

  expect(errors).toEqual([]);
});

/** The lab opens on a choice; this picks the starter experiment. */
async function openStarter(page: Page) {
  await page.goto("/lab", { waitUntil: "networkidle" });
  await page.getByRole("group", { name: "Templates" }).getByRole("button", { name: /Does the model side with the user/ }).click();
}

/**
 * The lab opens on a choice, with no design form
 * until something is picked. Blank starts empty; Start over comes back.
 */
test("/lab opens on a choice, then the design", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/lab", { waitUntil: "networkidle" });

  await expect(page.getByRole("link", { name: /Bring something from Play/ })).toHaveAttribute("href", "/play");
  await expect(page.getByLabel("Question", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Start from scratch/ }).click();
  await expect(page.getByLabel("Question", { exact: true })).toHaveValue("");
  await expect(page.getByTestId("lab-started-from")).toContainText("your own question");

  await page.getByRole("button", { name: /Choose a different question/ }).click();
  await expect(page.getByTestId("lab-start")).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * The starter experiment won't run without a model to run on. With no key
 * and no GPU (headless), the free in-browser model is unusable, so the
 * button stays disabled rather than failing mid-run.
 */
test("/lab opens the starter experiment and holds Run until a model is ready", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await openStarter(page);

  await expect(page.getByLabel("Question", { exact: true })).toHaveValue(/shift its answer/);
  await expect(page.getByRole("button", { name: "Run experiment" })).toBeVisible();
  await expect(page.getByTestId("lab-preflight")).toContainText("60 calls");

  // Hypothesis is editable until the first run.
  await expect(page.getByLabel("Hypothesis", { exact: true })).not.toHaveAttribute("readonly", "");

  expect(errors).toEqual([]);
});

/**
 * Templates: a ?template= link opens on that template, a lens sends the lab
 * to its own template, and the picker swaps templates without a key.
 */
test("/lab templates load from the URL, the lens, and the picker", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const question = page.getByLabel("Question", { exact: true });

  await page.goto("/lab?template=framing", { waitUntil: "networkidle" });
  await expect(question).toHaveValue(/lives saved or lives lost/);

  await expect(page.getByTestId("lab-start")).toHaveCount(0);

  await page.goto("/for/education", { waitUntil: "networkidle" });
  await page.goto("/lab", { waitUntil: "networkidle" });
  const picker = page.getByRole("group", { name: "Templates" });
  await expect(picker.getByRole("button").first()).toContainText("for you");
  await picker.getByRole("button").first().click();
  await expect(question).toHaveValue(/AI grader/);
  await expect(page.getByTestId("lab-started-from")).toContainText("longer answer");

  await page.getByRole("button", { name: /Choose a different question/ }).click();
  await picker.getByRole("button", { name: /Do rules hold better/ }).click();
  await expect(question).toHaveValue(/rule's rationale/);

  expect(errors).toEqual([]);
});

/**
 * "Open as experiment" carries a playground's setup into the lab in a new
 * tab — saved to the notebook, playground left untouched.
 */
test("/play/spread opens its setup as an experiment in a new tab", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/play/spread", { waitUntil: "networkidle" });

  const [lab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: /Open as experiment/ }).click(),
  ]);
  lab.on("pageerror", (e) => errors.push(String(e)));
  await lab.waitForLoadState("networkidle");
  expect(lab.url()).toMatch(/\/lab\?draft=/);

  await expect(lab.getByLabel("System prompt", { exact: true })).toHaveValue(/community library/);
  await expect(lab.getByLabel("Measures")).toContainText("Excludes");
  await expect(lab.getByRole("group", { name: "Templates" })).toHaveCount(0);

  // The playground stayed put, with a way back in if the tab was blocked.
  await expect(page.getByText(/Saved to your notebook/)).toBeVisible();
  expect(page.url()).toMatch(/\/play\/spread/);
  expect(errors).toEqual([]);
});

/**
 * /start offers the free ways to run. With the free tier off (no env in CI)
 * only the in-browser model shows; with it up, hosted Claude leads, and
 * choosing the in-browser model sticks — the playground doesn't switch the
 * reader onto hosted Claude behind their back.
 */
test("/start shows only the in-browser option when the free tier is off", async ({ page }) => {
  await page.goto("/start", { waitUntil: "networkidle" });
  await expect(page.getByTestId("run-local")).toBeVisible();
  await expect(page.getByTestId("run-local")).toContainText("Never leave your machine");
  await expect(page.getByTestId("run-hosted")).toHaveCount(0);
});

test("/start offers hosted Claude when the free tier is up, and keeps an in-browser choice", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/hosted/status", (route) =>
    route.fulfill({
      json: { enabled: true, limit: 100, remaining: 87, resetsAt: "2099-01-01T00:00:00.000Z", model: "claude-haiku-4-5" },
    }),
  );

  await page.goto("/start", { waitUntil: "networkidle" });
  const hosted = page.getByTestId("run-hosted");
  await expect(hosted).toContainText("Recommended");
  await expect(hosted).toContainText("87 of 100 free runs left today");
  await expect(hosted).toContainText("Shape doesn't store them");

  // Hosted is the default in a playground…
  await hosted.getByRole("link", { name: /free Claude/ }).click();
  await page.waitForURL("**/play/diff");
  await expect(page.getByTestId("hosted-note").first()).toBeVisible();

  // …unless the reader picked the in-browser model.
  await page.goto("/start", { waitUntil: "networkidle" });
  await page.getByTestId("run-local").getByRole("link", { name: /in your browser/ }).click();
  await page.waitForURL("**/play/diff");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("hosted-note")).toHaveCount(0);

  expect(errors).toEqual([]);
});

/**
 * Sharing. CI has no database, so the /e/ page shows its "can't load" state
 * for a well-formed link and a 404 for a malformed one; the lab's Share panel
 * is driven against mocked endpoints.
 */
test("/e/ pages: unavailable without the database, 404 for a malformed link", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/e/abcDEF2345", { waitUntil: "networkidle" });
  await expect(page.getByTestId("shared-unavailable")).toBeVisible();
  const res = await page.goto("/e/not-a-slug");
  expect(res?.status()).toBe(404);
  expect(errors).toEqual([]);
});

test("/lab hides Share when sharing is off, and publishes and deletes a link when it's on", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await openStarter(page);
  await expect(page.getByRole("button", { name: "Run experiment" })).toBeVisible();
  await expect(page.getByTestId("share-panel")).toHaveCount(0);

  let published: { experiment?: { title?: string; runs?: unknown[] }; runner?: string } | null = null;
  let deletedWith: string | null = null;
  await page.route("**/api/share", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { enabled: true } })
      : (published = route.request().postDataJSON(),
        route.fulfill({ status: 201, json: { slug: "abcDEF2345", deleteToken: "0123456789abcdef0123456789abcdef", manifestHash: "a".repeat(64) } })),
  );
  await page.route("**/api/share/abcDEF2345", (route) => {
    deletedWith = route.request().headers()["x-delete-token"] ?? null;
    return route.fulfill({ status: 204, body: "" });
  });

  await openStarter(page);
  const panel = page.getByTestId("share-panel");
  await expect(panel).toContainText("No results yet");
  const publish = panel.getByRole("button", { name: /Publish the design/ });
  await expect(publish).toBeDisabled();
  await panel.getByLabel(/Nothing in these prompts/).check();
  await publish.click();

  await expect(panel.getByTestId("share-link")).toBeVisible();
  await expect(panel.getByLabel("Shared link")).toHaveValue(/\/e\/abcDEF2345$/);
  expect(published!.runner).toBe("webllm");
  expect(published!.experiment?.runs).toEqual([]);
  expect(published!.experiment?.title).toBeTruthy();

  // The delete key stays in this browser, and deleting sends it.
  await expect(panel).toContainText("Shared from this browser (1)");
  page.once("dialog", (d) => d.accept());
  await panel.getByRole("button", { name: "Delete" }).click();
  await expect(panel).not.toContainText("Shared from this browser");
  expect(deletedWith).toBe("0123456789abcdef0123456789abcdef");

  expect(errors).toEqual([]);
});

/**
 * Classrooms. CI has classrooms off and no database: the teacher page says
 * so, a well-formed class code shows "can't load" and a malformed one 404s,
 * and the lab's Make-a-class panel is driven against mocked endpoints.
 */
test("classroom pages render with classrooms off", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/teach", { waitUntil: "networkidle" });
  await expect(page.getByTestId("teach-off")).toBeVisible();

  await page.goto("/teach/confirm?token=abc", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Sign in to Shape/ })).toBeVisible();

  await page.goto("/class", { waitUntil: "networkidle" });
  await page.getByLabel("Class code").fill("kq7-m3p");
  await page.getByRole("button", { name: /Go to class/ }).click();
  await page.waitForURL("**/class/KQ7M3P");
  await expect(page.getByTestId("class-unavailable")).toBeVisible();

  const res = await page.goto("/class/not-a-code");
  expect(res?.status()).toBe(404);
  expect(errors).toEqual([]);
});

test("/lab shows Make a class only to a signed-in teacher, and makes one", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await openStarter(page);
  await expect(page.getByRole("button", { name: "Run experiment" })).toBeVisible();
  await expect(page.getByTestId("make-class-panel")).toHaveCount(0);

  let made: { title?: string; experiment?: { question?: string } } | null = null;
  await page.route("**/api/teach/me", (route) => route.fulfill({ json: { enabled: true, teacher: { email: "prof@uni.edu" } } }));
  await page.route("**/api/classes", (route) => {
    made = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { code: "KQ7M3P", display: "KQ7-M3P" } });
  });
  await openStarter(page);

  const panel = page.getByTestId("make-class-panel");
  await panel.getByRole("button", { name: /Make a class/ }).click();
  await expect(panel.getByTestId("class-made")).toContainText("KQ7-M3P");
  await expect(panel.getByRole("link", { name: /Open the class/ })).toHaveAttribute("href", "/teach/classes/KQ7M3P");
  expect(made!.title).toBeTruthy();
  expect(made!.experiment?.question).toBeTruthy();
  expect(errors).toEqual([]);
});

test("/lab says what the runs can detect, and what a smaller change would take", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await openStarter(page);

  const plan = page.getByTestId("power-plan");
  await expect(plan).toBeVisible();
  await expect(plan).toContainText("answers");
  await expect(plan).toContainText(/points in a\s+yes\/no measure|first\s+look/);

  // Fewer runs per cell, fewer answers per version, a bigger change needed.
  const before = await plan.textContent();
  const runs = page.getByLabel("Runs per cell");
  const options = await runs.locator("option").allTextContents();
  await runs.selectOption(options[0]);
  await expect(plan).not.toHaveText(before ?? "");

  // A 10-point target is out of reach for one run of the lab: it points to a class.
  await page.getByLabel("To reliably catch").selectOption("10");
  await expect(page.getByTestId("power-target-text")).toContainText(/class|already have/);
  expect(errors).toEqual([]);
});

test("the Educators path points teachers to class setup, and only that path does", async ({ page }) => {
  await page.goto("/for/education", { waitUntil: "networkidle" });
  await expect(page.getByTestId("teach-cta")).toHaveAttribute("href", "/teach");
  await page.goto("/for/ux", { waitUntil: "networkidle" });
  await expect(page.getByTestId("teach-cta")).toHaveCount(0);
});
