// Builds release artifacts into dist/:
//   dist/hide-google-ai-overviews.zip   — for the Chrome Web Store (no key / update_url)
//   dist/hide-google-ai-overviews.crx   — signed CRX for self-hosted / admin force-install
//   dist/updates.xml                    — Chrome auto-update manifest pointing at the CRX
//
// Env:
//   CRX_PRIVATE_KEY  PEM private key (required for .crx; same key forever = same extension ID)
//   VERSION          overrides manifest version (CI passes e.g. 1.0.37)
//   PAGES_URL        base URL where updates.xml/.crx are served
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createPrivateKey, createPublicKey, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import crx3 from "crx3";

const NAME = "hide-google-ai-overviews";
const PAGES_URL = (process.env.PAGES_URL || "https://thezvi.github.io/hide-google-ai-overviews").replace(/\/$/, "");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/stage", { recursive: true });
cpSync("extension", "dist/stage", { recursive: true });

const manifestPath = "dist/stage/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (process.env.VERSION) manifest.version = process.env.VERSION;
const version = manifest.version;

// 1) Web Store zip: plain manifest.
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const zipPath = `dist/${NAME}.zip`;
if (process.platform === "win32") {
  execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path dist/stage/* -DestinationPath ${zipPath} -Force`]);
} else {
  execFileSync("zip", ["-qr", `../${NAME}.zip`, "."], { cwd: "dist/stage" });
}
console.log(`built ${zipPath} (v${version})`);

// 2) Signed CRX + updates.xml for self-hosting.
const pem = process.env.CRX_PRIVATE_KEY;
if (!pem) {
  console.log("CRX_PRIVATE_KEY not set — skipping signed .crx / updates.xml");
  process.exit(0);
}
const keyPath = "dist/key.pem";
writeFileSync(keyPath, pem.includes("BEGIN") ? pem : Buffer.from(pem, "base64").toString("utf8"));
const der = createPublicKey(createPrivateKey(readFileSync(keyPath))).export({ type: "spki", format: "der" });
const id = [...createHash("sha256").update(der).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");

manifest.update_url = `${PAGES_URL}/updates.xml`;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

await crx3(["dist/stage/manifest.json"], {
  keyPath,
  crxPath: `dist/${NAME}.crx`,
  zipPath: `dist/${NAME}-selfhosted.zip`,
});
rmSync(keyPath);

writeFileSync(
  "dist/updates.xml",
  `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${id}'>
    <updatecheck codebase='${PAGES_URL}/${NAME}.crx' version='${version}' />
  </app>
</gupdate>
`
);
writeFileSync("dist/extension-id.txt", id + "\n");
console.log(`built dist/${NAME}.crx + updates.xml — extension ID ${id}`);
