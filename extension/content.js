// Hide Google AI Overviews — content script.
//
// Strategy (deliberately avoids Google's obfuscated class names, which change constantly):
//   1. Find a heading element whose entire text is "AI Overview" (or a localized equivalent).
//   2. Walk up from that heading to the largest ancestor that still contains ONLY the
//      AI Overview — i.e. stop before reaching anything that holds the organic results,
//      the search box, or the page layout containers.
//   3. Hide that ancestor. A MutationObserver repeats this as Google streams content in.
//
// Optional (on by default): hide the "AI Mode" tab/button and bounce udm=50 (AI Mode) URLs
// back to normal search. Optional (off by default): force the plain "Web" results view (udm=14).
//
// No network requests, no data collection. Settings come from chrome.storage.managed
// (set by a school/IT admin via policy, which locks them) or chrome.storage.sync (the user).

(() => {
  "use strict";

  const DEFAULTS = {
    hideOverviews: true,
    hideAiMode: true,
    forceWebResults: false,
  };

  // Exact (whole-text) heading labels. Compared case-insensitively after whitespace collapse.
  // Non-English entries are best-effort; corrections welcome via pull request.
  const OVERVIEW_LABELS = [
    "ai overview",
    "ai overviews",
    "overview from ai",
    "resumen de ia",          // es
    "vista creada con ia",    // es
    "aperçu ia",              // fr
    "aperçu généré par l'ia", // fr
    "übersicht mit ki",       // de
    "ki-übersicht",           // de
    "panoramica ai",          // it
    "panoramica ia",          // it
    "visão geral criada por ia", // pt
    "visão geral de ia",      // pt
    "ai-overzicht",           // nl
    "przegląd od ai",         // pl
    "ai による概要",          // ja
    "ai 개요",                // ko
    "ai 概览",                // zh-CN
    "ai 摘要",                // zh-TW
  ];
  const AI_MODE_LABELS = ["ai mode", "modo ia", "mode ia", "ki-modus", "modalità ai", "modo ia", "ai モード", "ai 모드", "ai 模式"];

  const HIDDEN_ATTR = "data-hgao-hidden";
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const overviewSet = new Set(OVERVIEW_LABELS.map(norm));
  const aiModeSet = new Set(AI_MODE_LABELS.map(norm));

  // Containers we must never hide or climb past.
  const STOP_IDS = new Set(["rcnt", "center_col", "rso", "search", "main", "cnt", "rhs", "appbar", "searchform", "top_nav", "hdtb"]);

  let settings = { ...DEFAULTS };

  // ---- URL-level behaviour (runs immediately at document_start) ----------------------------

  function handleUrl() {
    if (location.pathname !== "/search") return false;
    const url = new URL(location.href);
    const udm = url.searchParams.get("udm");
    if (settings.hideAiMode && udm === "50") {
      url.searchParams.delete("udm");
      if (settings.forceWebResults) url.searchParams.set("udm", "14");
      location.replace(url.toString());
      return true;
    }
    // Only rewrite plain "All" searches — never image/news/video/shopping etc.
    if (settings.forceWebResults && !udm && !url.searchParams.has("tbm") && url.searchParams.has("q")) {
      url.searchParams.set("udm", "14");
      location.replace(url.toString());
      return true;
    }
    return false;
  }

  // ---- DOM-level hiding --------------------------------------------------------------------

  function hide(el, reason) {
    if (!el || el.hasAttribute(HIDDEN_ATTR)) return;
    el.setAttribute(HIDDEN_ATTR, reason);
    el.style.setProperty("display", "none", "important");
  }

  function isStop(el) {
    return !el || el === document.body || el === document.documentElement || STOP_IDS.has(el.id) || el.tagName === "FORM";
  }

  // Would hiding `el` take out something that isn't part of the AI Overview?
  function containsNonOverviewContent(el) {
    // Note: the AI Overview has its own (unnamed, form-less) follow-up textarea, so only the
    // real search box — named "q" or inside a form — counts as a boundary.
    if (el.querySelector("#rso, #center_col, #search, #rhs, form, [name='q'], [role='search']")) return true;
    // Organic results are links wrapping an <h3>. The AI Overview cites sources but doesn't use a > h3.
    if (el.querySelector("a h3")) return true;
    return false;
  }

  function overviewContainerFor(heading) {
    let best = heading;
    let node = heading.parentElement;
    while (node && !isStop(node) && !containsNonOverviewContent(node)) {
      best = node;
      node = node.parentElement;
    }
    return best;
  }

  function findOverviewHeadings(root) {
    const out = [];
    const candidates = root.querySelectorAll("[role='heading'], h1, h2, h3, h4");
    for (const el of candidates) {
      if (el.hasAttribute(HIDDEN_ATTR) || el.closest(`[${HIDDEN_ATTR}]`)) continue;
      if (el.closest("a")) continue; // an ordinary result that happens to be titled "AI Overview"
      const t = norm(el.textContent);
      if (t.length > 40) continue;
      if (overviewSet.has(t)) out.push(el);
    }
    return out;
  }

  function hideOverviews() {
    for (const heading of findOverviewHeadings(document)) {
      hide(overviewContainerFor(heading), "ai-overview");
    }
  }

  function hideAiModeEntryPoints() {
    // Tab link in the results-page tab bar (and anywhere else that links to AI Mode).
    for (const a of document.querySelectorAll("a[href*='udm=50']")) {
      if (a.hasAttribute(HIDDEN_ATTR)) continue;
      const item = a.closest("[role='listitem']");
      hide(item && !isStop(item) ? item : a, "ai-mode");
    }
    // Buttons labelled "AI Mode" (e.g. inside the search box on the homepage).
    for (const b of document.querySelectorAll("button, [role='button'], [role='link']")) {
      if (b.hasAttribute(HIDDEN_ATTR) || isStop(b)) continue;
      const label = norm(b.getAttribute("aria-label")) || norm(b.textContent);
      if (aiModeSet.has(label)) hide(b, "ai-mode");
    }
  }

  function scan() {
    if (settings.hideOverviews) hideOverviews();
    if (settings.hideAiMode) hideAiModeEntryPoints();
  }

  function unhideAll() {
    for (const el of document.querySelectorAll(`[${HIDDEN_ATTR}]`)) {
      el.removeAttribute(HIDDEN_ATTR);
      el.style.removeProperty("display");
    }
  }

  // Coalesce bursts of mutations into one scan per microtask (runs before the next paint,
  // so the overview is normally hidden before it is ever drawn).
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      scan();
    });
  }

  let observer = null;
  function start() {
    if (observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    scan();
  }

  // ---- Settings ----------------------------------------------------------------------------

  // On unmanaged browsers chrome.storage.managed.get() may never call back, so every read
  // is capped with a short timeout and falls back to "no values".
  function storageGet(area) {
    return new Promise((resolve) => {
      setTimeout(() => resolve({}), 400);
      try {
        if (!chrome?.storage?.[area]) return resolve({});
        chrome.storage[area].get(null, (v) => resolve(chrome.runtime.lastError ? {} : v || {}));
      } catch {
        resolve({});
      }
    });
  }

  // Sync (user) settings normally arrive within a few ms; managed (admin) settings may never
  // arrive on unmanaged browsers. Apply each as soon as it is known; admin policy always wins.
  let syncValues = {};
  let managedValues = {};

  function computeSettings() {
    const merged = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (typeof syncValues[k] === "boolean") merged[k] = syncValues[k];
      if (typeof managedValues[k] === "boolean") merged[k] = managedValues[k];
    }
    return merged;
  }

  let redirected = false;
  function apply() {
    const next = computeSettings();
    const changed = Object.keys(DEFAULTS).some((k) => next[k] !== settings[k]);
    settings = next;
    if (!redirected && handleUrl()) { redirected = true; return; }
    if (changed) { unhideAll(); scan(); }
  }

  function refresh() {
    storageGet("sync").then((v) => { syncValues = v; apply(); });
    storageGet("managed").then((v) => { managedValues = v; apply(); });
  }

  // Start hiding immediately with defaults (no flash while settings load), then refine.
  start();
  refresh();

  try {
    chrome.storage.onChanged.addListener(refresh);
  } catch {
    /* not available in test harnesses */
  }

})();
