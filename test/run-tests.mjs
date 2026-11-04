// Offline regression tests: serve synthetic Google pages at real google.com URLs (via request
// interception) so the content script is injected exactly as it would be in production.
import { launchWithExtension, setSettings } from "./launch.mjs";
import { pages } from "./fixtures.mjs";

const { context, extensionId, cleanup } = await launchWithExtension();
let currentPage = "standard";
await context.route(/^https:\/\/www\.google\.(com|de)\//, (route) =>
  route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: pages[currentPage] })
);

let failures = 0;
async function test(name, fn) {
  const page = await context.newPage();
  try {
    await fn(page);
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL  ${name}\n        ${e.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const visible = (page, sel) => page.locator(sel).first().isVisible();

async function load(page, which, url = "https://www.google.com/search?q=sky") {
  currentPage = which;
  await page.goto(url);
  await page.waitForTimeout(150);
}

console.log("Hide Google AI Overviews — fixture tests");

await test("hides AI Overview (current layout) and keeps results", async (page) => {
  await load(page, "standard");
  assert(!(await visible(page, "[data-t=overview-body]")), "overview body still visible");
  assert(await visible(page, "[data-t=organic] h3"), "organic results were hidden");
  assert(await visible(page, "[data-t=rhs]"), "knowledge panel was hidden");
  assert(await visible(page, "textarea[name=q]"), "search box was hidden");
});

await test("hides AI Overview rendered inside #rso (older layout)", async (page) => {
  await load(page, "insideRso");
  assert(!(await visible(page, "[data-t=overview-body]")), "overview body still visible");
  assert(await visible(page, "[data-t=organic] h3"), "organic results were hidden");
});

await test("hides an AI Overview that streams in after load", async (page) => {
  await load(page, "lateLoading");
  await page.waitForSelector("[data-t=overview-body]", { state: "attached" });
  await page.waitForTimeout(100);
  assert(!(await visible(page, "[data-t=overview-body]")), "late overview still visible");
  assert(await visible(page, "[data-t=organic] h3"), "organic results were hidden");
});

await test("leaves pages without an overview untouched (incl. result titled 'AI Overview')", async (page) => {
  await load(page, "control");
  const hidden = await page.locator("[data-hgao-hidden=ai-overview]").count();
  assert(hidden === 0, `${hidden} elements wrongly hidden`);
  assert(await visible(page, "text=AI Overview"), "organic result titled 'AI Overview' was hidden");
});

await test("handles a localized label (German)", async (page) => {
  await load(page, "german", "https://www.google.de/search?q=himmel");
  assert(!(await visible(page, "[data-t=overview-body]")), "German overview still visible");
});

await test("hides the AI Mode tab, keeps other tabs", async (page) => {
  await load(page, "standard");
  assert(!(await visible(page, "[data-t=aimode]")), "AI Mode tab still visible");
  assert(await visible(page, "[data-t=images]"), "Images tab was hidden");
});

await test("redirects AI Mode (udm=50) URLs to normal search", async (page) => {
  await load(page, "standard", "https://www.google.com/search?q=sky&udm=50");
  await page.waitForURL((u) => !u.href.includes("udm=50"), { timeout: 3000 }).catch(() => {});
  const u = new URL(page.url());
  assert(u.searchParams.get("udm") !== "50", `still on AI Mode: ${page.url()}`);
  assert(u.searchParams.get("q") === "sky", "query lost");
});

await test("forceWebResults=true rewrites to udm=14 but not image search", async (page) => {
  await setSettings(context, extensionId, { forceWebResults: true });
  await load(page, "standard", "https://www.google.com/search?q=sky");
  await page.waitForURL(/udm=14/, { timeout: 3000 });
  await load(page, "standard", "https://www.google.com/search?q=sky&udm=2");
  await page.waitForTimeout(300);
  assert(new URL(page.url()).searchParams.get("udm") === "2", "image search was rewritten");
  await setSettings(context, extensionId, { forceWebResults: false });
});

await test("hideOverviews=false shows the overview again", async (page) => {
  await setSettings(context, extensionId, { hideOverviews: false });
  await load(page, "standard");
  await page.waitForTimeout(200);
  assert(await visible(page, "[data-t=overview-body]"), "overview hidden despite setting");
  await setSettings(context, extensionId, { hideOverviews: true });
});

await test("options page renders all three settings", async (page) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  for (const id of ["hideOverviews", "hideAiMode", "forceWebResults"]) {
    assert(await page.locator(`#${id}`).isVisible(), `missing #${id}`);
  }
});

await cleanup();
console.log(failures ? `\n${failures} test(s) failed` : "\nall tests passed");
process.exit(failures ? 1 : 0);
