// Synthetic Google results pages that mirror the real DOM structure observed on
// google.com (Nov 2026): the AI Overview is a sibling of #center_col inside #rcnt, uses an
// obfuscated-class [role=heading] containing "AI Overview", and contains its own unnamed
// follow-up <textarea>. Class names here are random on purpose — the extension must not rely on them.

const head = `<!doctype html><html><head><meta charset="utf-8"><title>test - Google Search</title></head><body>`;
const searchForm = `<form id="tsf" action="/search"><textarea name="q">test</textarea></form>`;
const tabs = (q) => `
  <div id="hdtb"><div role="list">
    <div role="listitem" data-t="aimode"><a href="/search?q=${q}&udm=50"><span>AI Mode</span></a></div>
    <div role="listitem" data-t="all"><span>All</span></div>
    <div role="listitem" data-t="images"><a href="/search?q=${q}&udm=2">Images</a></div>
  </div></div>`;

export const overviewBlock = (label = "AI Overview") => `
  <div class="Xq7zb">
    <style>.k9Pq{color:inherit}</style>
    <div class="Ae2kL" data-hveid="1">
      <div><div><section><div jsname="x" data-rl="en"><div>
        <div class="hZr" jscontroller="a"><div role="heading" aria-level="2"><strong>${label}</strong></div></div>
        <div class="Bd6t" data-t="overview-body">The sky is blue because of Rayleigh scattering.
          <a href="https://example.org/source">Source</a>
        </div>
        <div><textarea placeholder="Ask a follow up"></textarea></div>
      </div></div></section></div></div>
    </div>
  </div>`;

const organic = (title = "Why Is the Sky Blue? | NASA") => `
  <div class="MjjYud" data-t="organic"><div><a href="https://spaceplace.nasa.gov/"><h3>${title}</h3></a>
  <div>Blue light is scattered more than the other colors.</div></div></div>`;

const rhs = `<div id="rhs" data-t="rhs"><div role="heading">Sky</div><div>Knowledge panel</div></div>`;

export const pages = {
  // Current layout: overview is a sibling of #center_col.
  standard: head + searchForm + tabs("sky") + `
    <div id="cnt"><div id="rcnt">
      <div style="display:none"></div>
      ${overviewBlock()}
      <div id="center_col"><div id="rso">${organic()}${organic("Sky - Wikipedia")}</div></div>
      ${rhs}
    </div></div></body></html>`,

  // Older layout: overview rendered as the first block inside #rso.
  insideRso: head + searchForm + tabs("sky") + `
    <div id="cnt"><div id="rcnt"><div id="center_col"><div id="rso">
      ${overviewBlock()}
      ${organic()}
    </div></div></div></div></body></html>`,

  // Overview streams in after load (the normal real-world case).
  lateLoading: head + searchForm + tabs("sky") + `
    <div id="cnt"><div id="rcnt">
      <div id="ai-slot"></div>
      <div id="center_col"><div id="rso">${organic()}</div></div>
    </div></div>
    <script>
      setTimeout(() => { document.getElementById("ai-slot").innerHTML = ${JSON.stringify(overviewBlock())}; }, 400);
    </script></body></html>`,

  // No overview at all, plus an organic result literally titled "AI Overview": nothing may be hidden.
  control: head + searchForm + tabs("sky") + `
    <div id="cnt"><div id="rcnt"><div id="center_col"><div id="rso">
      ${organic("AI Overview")}${organic()}
    </div></div>${rhs}</div></div></body></html>`,

  // Localized label.
  german: head + searchForm + `
    <div id="cnt"><div id="rcnt">${overviewBlock("Übersicht mit KI")}
      <div id="center_col"><div id="rso">${organic()}</div></div></div></div></body></html>`,
};
