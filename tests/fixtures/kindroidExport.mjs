// Kindroid export through the real popup: a fake Kindroid API, the raw bytes handed
// to the download, and the state left behind.
// Usage: kindroidExport.mjs <ok | http401 | nokey | notkn | zerowidth>
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : ["2026-10-01T12:00:00Z"]));
  }
};

const scenario = process.argv[2];
const keys = { nokey: "", notkn: "abc123", zerowidth: `kn_abc${String.fromCharCode(0x200b)}def` };
const apiKey = keys[scenario] ?? "  kn_fixturekey  ";
let submit;
let downloadedBlob;
let filename;
const elements = new Map([
  ["#participant-id", { value: "040" }],
  ["#from-date", { value: "2026-09-29" }],
  ["#to-date", { value: "2026-09-29" }],
  ["#api-key", { value: apiKey }],
  ["#export-button", {}],
  ["#status", { dataset: {} }],
  ["#progress", {}],
  ["#chat", { hidden: true }],
  ["#kindroid-key", { hidden: true }],
  ["#export-form", { addEventListener(_event, listener) { submit = listener; } }]
]);
globalThis.document = {
  querySelector: (selector) => elements.get(selector),
  body: { append() {} },
  createElement: () => ({
    click() { filename = this.download; },
    remove() {}
  })
};
URL.createObjectURL = (blob) => { downloadedBlob = blob; return "blob:test"; };
URL.revokeObjectURL = () => {};
// Any later lookup sees another chat: the export must stay with the one named at open.
let tabQueries = 0;
globalThis.chrome = {
  tabs: {
    query: async () => [tabQueries++ === 0
      ? { id: 1, url: "https://kindroid.ai/v2/chat/AI1", title: "Kin B" }
      : { id: 1, url: "https://kindroid.ai/v2/chat/AI2", title: "Kin C" }]
  }
};

const message = (id, iso, sender, text) => ({
  id, timestamp: Date.parse(iso), sender, display_name: sender === "ai" ? "B" : "Peng",
  ...(text === undefined ? { image_urls: ["https://example.invalid/a.jpg"] } : { message: text })
});
// The study window, Sep 29 in Los Angeles, is 2026-09-29T07:00Z to 2026-09-30T07:00Z.
const chat = [
  message("k-before", "2026-09-29T06:59:59.999Z", "ai", "Too early"),
  message("k-at-start", "2026-09-29T07:00:00.000Z", "user", "Good morning"),
  message("k-paragraphs", "2026-09-29T13:00:00.000Z", "ai", "*smiles*\n\nHow was your day?"),
  message("k-quote", "2026-09-29T14:30:15.250Z", "user", "She said \"hi\", then left"),
  message("k-image", "2026-09-29T15:00:00.000Z", "user"),
  message("k-unicode", "2026-09-29T16:00:00.000Z", "ai", "It’s fine — 你好 😊"),
  message("k-last-in", "2026-09-30T06:59:59.999Z", "ai", "Last moment of To"),
  message("k-at-end", "2026-09-30T07:00:00.000Z", "user", "At the end boundary"),
  message("k-after", "2026-09-30T10:00:00.000Z", "ai", "After")
];

const formFields = ["#participant-id", "#from-date", "#to-date", "#api-key", "#export-button"];
const disabledState = () => formFields.map((s) => Boolean(elements.get(s).disabled));
const requests = [];
let disabledDuringExport = null;
globalThis.fetch = async (url, init) => {
  disabledDuringExport ??= disabledState();
  // A setting change mid-export must not change the zone captured at submit.
  process.env.TZ = "America/New_York";
  const u = new URL(url);
  requests.push({ origin: u.origin + u.pathname, params: Object.fromEntries(u.searchParams), auth: init.headers.Authorization });
  if (scenario === "http401") return new Response("Unauthorized", { status: 401 });
  const limit = Number(u.searchParams.get("limit"));
  const after = u.searchParams.has("start_after_timestamp") ? Number(u.searchParams.get("start_after_timestamp")) : -Infinity;
  const page = chat.filter((m) => m.timestamp > after).slice(0, limit);
  return new Response(JSON.stringify({
    messages: page,
    pagination: { hasMore: page.length === limit, lastTimestamp: page.at(-1)?.timestamp ?? null, limit }
  }), { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
};

await import("../../extension/export.js");
await submit({ preventDefault() {} });
const element = (selector) => elements.get(selector);
console.log(JSON.stringify({
  filename,
  bytes: downloadedBlob ? Buffer.from(await downloadedBlob.arrayBuffer()).toString("base64") : null,
  status: element("#status").textContent,
  tone: element("#status").dataset.tone,
  progress: element("#progress").textContent,
  keyAfter: element("#api-key").value,
  disabledDuringExport,
  disabled: disabledState(),
  requests
}));
