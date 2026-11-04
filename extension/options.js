const DEFAULTS = { hideOverviews: true, hideAiMode: true, forceWebResults: false };

Promise.all([
  chrome.storage.sync.get(null),
  // managed.get() can hang on unmanaged browsers; don't let it block the page.
  Promise.race([
    chrome.storage.managed.get(null).catch(() => ({})),
    new Promise((r) => setTimeout(() => r({}), 400)),
  ]),
]).then(([sync, managed]) => {
  let anyLocked = false;
  for (const key of Object.keys(DEFAULTS)) {
    const box = document.getElementById(key);
    const locked = typeof managed[key] === "boolean";
    box.checked = locked ? managed[key] : typeof sync[key] === "boolean" ? sync[key] : DEFAULTS[key];
    if (locked) {
      anyLocked = true;
      box.disabled = true;
      box.closest("label").classList.add("locked");
    }
    box.addEventListener("change", () => chrome.storage.sync.set({ [key]: box.checked }));
  }
  if (anyLocked) document.getElementById("managed").style.display = "block";
});
