// Opens the real popup on a tab and reports what the participant sees before
// submitting. Usage: popupOpen.mjs <tab url> [tab title]; --query-fails as the URL
// makes chrome.tabs.query reject.
const [url, title = ""] = process.argv.slice(2);
const elements = new Map([
  ["#participant-id", {}],
  ["#from-date", {}],
  ["#to-date", {}],
  ["#api-key", {}],
  ["#export-button", {}],
  ["#status", { dataset: {} }],
  ["#progress", {}],
  ["#chat", { hidden: true }],
  ["#kindroid-key", { hidden: true }],
  ["#export-form", { addEventListener() {} }]
]);
globalThis.document = { querySelector: (selector) => elements.get(selector) };
globalThis.chrome = { tabs: { query: async () => {
  if (url === "--query-fails") throw new Error("No tab with id");
  return [{ id: 1, url, title }];
} } };

await import("../../extension/export.js");
await new Promise((resolve) => setTimeout(resolve, 0));
const element = (selector) => elements.get(selector);
console.log(JSON.stringify({
  keyHidden: element("#kindroid-key").hidden,
  chatHidden: element("#chat").hidden,
  chat: element("#chat").textContent ?? "",
  status: element("#status").textContent ?? "",
  tone: element("#status").dataset.tone ?? "",
  disabled: ["#participant-id", "#from-date", "#to-date", "#export-button"].map((s) => Boolean(element(s).disabled))
}));
