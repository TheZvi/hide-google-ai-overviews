// Live canary: loads real Google searches with the extension installed and classifies each:
//   hidden   — an AI Overview was present and the extension hid it            (good)
//   VISIBLE  — an AI Overview is on screen despite the extension               (broken!)
//   none     — Google showed no recognizable AI Overview for this query        (inconclusive)
//   blocked  — Google served a CAPTCHA / consent wall (common on CI IP ranges)  (inconclusive)
//
// Writes live-check-output/result.json plus a screenshot and HTML of every non-"hidden" page,
// so a human (or an automated fixer) can see what Google changed.
// Exit code: 1 if any query is VISIBLE, else 0.
import { launchWithExtension } from "./launch.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const QUERIES = [
  "why is the sky blue",
  "how do vaccines work",
  "what causes the seasons",
  "how does photosynthesis work",
  "what is the difference between weather and climate",
  "how do plants grow from seeds",
];

const OUT = "live-check-output";
mkdirSync(OUT, { recursive: true });

const headed = process.argv.includes("--headed") || process.env.HEADED === "1";
const { context, cleanup } = await launchWithExtension({ headless: !headed });
// Pre-accept nothing: if Google shows a consent wall we report "blocked" rather than click it.
const results = [];

for (const [i, q] of QUERIES.entries()) {
  const page = await context.newPage();
  let status = "none";
  let detail = "";
  try {
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&gl=us`, { waitUntil: "domcontentloaded", timeout: 30000 });
    // In headed mode, a human can clear Google's CAPTCHA / consent wall: wait for them
    // (up to 5 minutes) instead of recording "blocked". The solved cookie then carries over
    // to the remaining queries, since they share one browser profile.
    if (headed && /\/sorry\/|consent\.google/.test(page.url())) {
      console.log(`  ⏸  Google is asking for a CAPTCHA/consent — please complete it in the browser window (waiting up to 5 min)...`);
      await page.waitForURL((u) => !/\/sorry\/|consent\.google/.test(u.href), { timeout: 300000 }).catch(() => {});
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
    await page.waitForTimeout(5000); // let the overview stream in
    const url = page.url();
    const probe = await page.evaluate(() => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const headings = [...document.querySelectorAll("[role='heading'], h1, h2, h3, h4")].filter(
        (el) => !el.closest("a") && /^ai overviews?$/.test(norm(el.textContent))
      );
      return {
        text: document.body ? document.body.innerText.slice(0, 400) : "",
        hiddenCount: document.querySelectorAll("[data-hgao-hidden='ai-overview']").length,
        visibleHeadings: headings.filter(isVisible).length,
        anyHeadings: headings.length,
        aiModeTabVisible: [...document.querySelectorAll("a[href*='udm=50']")].some(isVisible),
        hasResults: !!document.querySelector("#rso, #search"),
      };
    });
    if (/\/sorry\//.test(url) || /unusual traffic|not a robot/i.test(probe.text) || /consent\.google/.test(url) || /Before you continue/i.test(probe.text)) {
      status = "blocked";
      detail = url.split("?")[0];
    } else if (probe.visibleHeadings > 0) {
      status = "VISIBLE";
      detail = `${probe.visibleHeadings} visible AI Overview heading(s)`;
    } else if (probe.hiddenCount > 0) {
      status = "hidden";
    } else if (!probe.hasResults) {
      status = "blocked";
      detail = "no results container found";
    }
    if (probe.aiModeTabVisible) detail += (detail ? "; " : "") + "AI Mode tab visible";
    if (status !== "hidden") {
      await page.screenshot({ path: `${OUT}/${i}-${status}.png`, fullPage: false });
      writeFileSync(`${OUT}/${i}-${status}.html`, await page.content());
    }
  } catch (e) {
    status = "blocked";
    detail = `error: ${e.message.split("\n")[0]}`;
  }
  results.push({ query: q, status, detail });
  console.log(`${status.padEnd(8)} ${q}${detail ? `  (${detail})` : ""}`);
  await page.close();
}
await cleanup();

const count = (s) => results.filter((r) => r.status === s).length;
const summary = {
  checkedAt: new Date().toISOString(),
  verdict: count("VISIBLE") ? "broken" : count("hidden") ? "working" : count("blocked") === results.length ? "blocked" : "inconclusive",
  hidden: count("hidden"),
  visible: count("VISIBLE"),
  none: count("none"),
  blocked: count("blocked"),
  aiModeTabVisible: results.some((r) => r.detail.includes("AI Mode tab visible")),
  results,
};
writeFileSync(`${OUT}/result.json`, JSON.stringify(summary, null, 2));
console.log(`\nverdict: ${summary.verdict}`);
process.exit(summary.visible ? 1 : 0);
