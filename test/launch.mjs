// Launches Chromium with the extension loaded (unpacked), using a throwaway test key so
// the extension ID is known and the options page can be driven.
import { chromium } from "playwright";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateKeyPairSync, createHash } from "node:crypto";

export function extensionIdFromPublicKeyDer(der) {
  const hex = createHash("sha256").update(der).digest("hex").slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

export async function launchWithExtension({ headless = true } = {}) {
  const work = mkdtempSync(join(tmpdir(), "hgao-"));
  const extDir = join(work, "ext");
  cpSync(resolve("extension"), extDir, { recursive: true });

  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const der = publicKey.export({ type: "spki", format: "der" });
  const manifest = JSON.parse(readFileSync(join(extDir, "manifest.json"), "utf8"));
  manifest.key = der.toString("base64");
  writeFileSync(join(extDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  const extensionId = extensionIdFromPublicKeyDer(der);

  const context = await chromium.launchPersistentContext(join(work, "profile"), {
    channel: "chromium", // full Chromium (new headless) — the headless shell can't run extensions
    headless,
    locale: "en-US",
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, "--lang=en-US"],
  });
  const cleanup = async () => {
    await context.close();
    try { rmSync(work, { recursive: true, force: true }); } catch {}
  };
  return { context, extensionId, cleanup };
}

export async function setSettings(context, extensionId, values) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate((v) => chrome.storage.sync.set(v), values);
  await page.close();
}
