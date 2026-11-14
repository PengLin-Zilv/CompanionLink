// Gemini export through the real popup: a fake gemini.google.com behind the real in-tab
// function, the raw bytes handed to the download, and the state left behind.
// Usage: geminiExport.mjs <ok | signed-out | account>
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : ["2026-10-15T12:00:00Z"]));
  }
};

const scenario = process.argv[2];
// account: the chat is open under a second signed-in Google account.
const accountPath = scenario === "account" ? "/u/1" : "";

// The same synthetic page values as tests/geminiClient.test.js, and the copy of its
// setupScript: a change to how the page writes them lands in both.
const TOKEN = "synthetic_at_token_0123456789:1730000000000";
const BL = "boq_synthetic-web-uiserver_20261029.22_p0";
const FSID = "-7777777777777777777";
const EMAIL = "synthetic.person@example.invalid";
const NAME = "Synthetic Person";
function setupScript({ at = TOKEN, bl = BL, fsid = FSID } = {}) {
  const values = { FdrFJe: fsid, Im6cmf: "/_/BardChatUi", SNlM0e: at, cfb2h: bl, qSynthMail: EMAIL, qSynthName: NAME };
  return `window.WIZ_global_data = ${JSON.stringify(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)))};`;
}

let submit;
let downloadedBlob;
let filename;
const elements = new Map([
  ["#participant-id", { value: "040" }],
  ["#from-date", { value: "2026-10-13" }],
  ["#to-date", { value: "2026-10-13" }],
  ["#api-key", { value: "" }],
  ["#export-button", {}],
  ["#status", { dataset: {} }],
  // Gemini never scrolls the status into view (the reveal is Kindroid-only).
  ["#progress", { reveals: 0, scrollIntoView() { this.reveals += 1; } }],
  ["#kindroid-key", { hidden: true }],
  ["#export-form", { addEventListener(_event, listener) { submit = listener; }, dataset: {} }]
]);
globalThis.document = {
  querySelector: (selector) => elements.get(selector),
  body: { append() {} },
  createElement: () => ({
    click() { filename = this.download; },
    remove() {}
  }),
  // What the function in the tab reads. signed-out: no token, but the rest of the setup
  // script, so a leak of it would show.
  scripts: [{ textContent: "" }, { textContent: setupScript(scenario === "signed-out" ? { at: null } : {}) }],
  documentElement: { lang: "en" }
};
URL.createObjectURL = (blob) => { downloadedBlob = blob; return "blob:test"; };
URL.revokeObjectURL = () => {};

// Any later lookup sees another chat in another tab: the export must stay with the one
// open when the popup opened.
const C1 = "fedcba9876543210";
const C2 = "00112233445566ff";
let tabQueries = 0;
const injections = [];
globalThis.chrome = {
  tabs: {
    query: async () => [tabQueries++ === 0
      ? { id: 7, url: `https://gemini.google.com${accountPath}/app/${C1}` }
      : { id: 8, url: `https://gemini.google.com/app/${C2}` }]
  },
  scripting: {
    executeScript: async ({ target, func, args }) => {
      injections.push(target.tabId);
      // Chrome rebuilds the function from its source in the page; no pause between pages.
      return [{ result: await new Function(`return (${func})`)()(...args.slice(0, 5), 0) }];
    }
  }
};

// The same synthetic shapes as tests/geminiClient.test.js.
const pair = (iso, extraNanos = 0) => {
  const ms = Date.parse(iso);
  return [Math.floor(ms / 1000), (ms % 1000) * 1e6 + extraNanos];
};
const draft = (id, text, status = 2) => [id, [text], null, null, null, null, null, null, [status], "en"];
const turn = (n, time, prompt, reply, { drafts, shown } = {}) => [
  [`c_${C1}`, `r_${n}`],
  null,
  [[prompt, null, null, null], 2, null, 1],
  [drafts ?? [draft(`rc_${n}`, reply), draft(`rc_${n}x`, "")], null, null, shown ?? `rc_${n}`, null, null, null, true],
  time
];
const chain = (turns) => turns.map((t, index) => {
  const older = turns[index + 1];
  return [t[0], older ? [`c_${C1}`, older[0][1], older[3][3]] : null, ...t.slice(2)];
});
const payload = (turns, cursor) => [turns, cursor, null, []];
const response = (p) => `)]}'\n\n123\n${JSON.stringify([["wrb.fr", "hNvQHb", JSON.stringify(p), null, null, null, "generic"], ["di", 59], ["af.httprm", 58, "-1234", 24]])}\n25\n[["e",4,null,null,1234]]\n`;

// The study window, Oct 13 in Los Angeles, is 2026-10-13T07:00Z to 2026-10-14T07:00Z.
const turns = chain([
  turn(9, pair("2026-10-14T07:00:00.000Z"), "Still there?", "At the end boundary"),
  turn(8, pair("2026-10-14T06:59:59.000Z", 999_999_999), "Last moment of To", "Goodnight!"),
  turn(7, pair("2026-10-13T16:00:00.000Z"), "", "What a lovely photo."),
  turn(6, pair("2026-10-13T15:00:00.000Z"), "Pick a name", null,
    { drafts: [draft("rc_6a", "Draft one: Sam"), draft("rc_6b", "Draft two: Alex")], shown: "rc_6b" }),
  turn(5, pair("2026-10-13T14:31:00.000Z"), "Draw a cat", "Here it is:\nhttp://googleusercontent.com/image_generation_content/0"),
  turn(4, pair("2026-10-13T13:00:05.123Z", 456_789), "She said \"hi\", then left",
    " It’s fine — 你好 😊\n\n**Two ideas:**\n- Walk, then read\n- Rest"),
  turn(3, pair("2026-10-13T07:00:00.000Z"), "Good morning", "Morning!"),
  turn(2, pair("2026-10-13T06:59:59.000Z"), "Too early", "Early"),
  turn(1, pair("2026-10-11T12:00:00.000Z"), "Hello from last week", "Hi"),
  // On the page cursor-c asks for, which is never read: only g1's link names it.
  turn(0, pair("2026-10-10T12:00:00.000Z"), "Older still", "Hi again")
]).slice(0, -1);
// Page A, the newest turns, then page B. g1, page B's oldest turn, is before From, so
// paging stops there although page B has a cursor.
const pageA = payload(turns.slice(0, 6), "cursor-b");
const pageB = payload(turns.slice(6), "cursor-c");

const formFields = ["#participant-id", "#from-date", "#to-date", "#api-key", "#export-button"];
const disabledState = () => formFields.map((s) => Boolean(elements.get(s).disabled));
const requests = [];
const sends = [];
let disabledDuringExport = null;
globalThis.fetch = async (url, init) => {
  disabledDuringExport ??= disabledState();
  sends.push({ status: elements.get("#status").textContent, progress: elements.get("#progress").textContent });
  // A setting change mid-export must not change the zone captured at submit.
  process.env.TZ = "America/New_York";
  const { origin, pathname } = new URL(url);
  const body = new URLSearchParams(init.body);
  const [chat, , cursor] = JSON.parse(JSON.parse(body.get("f.req"))[0][0][1]);
  // Whether the token was sent, never the token itself.
  requests.push({
    endpoint: `${origin}${pathname}`, chat, cursor, tokenSent: body.get("at") === TOKEN,
    credentials: init.credentials, cache: init.cache
  });
  if (`${origin}${pathname}` === `https://gemini.google.com${accountPath}/_/BardChatUi/data/batchexecute` && chat === `c_${C1}`) {
    if (cursor === null) return new Response(response(pageA));
    if (cursor === "cursor-b") return new Response(response(pageB));
  }
  return new Response("Unexpected request", { status: 500 });
};

await import("../../extension/export.js");
await submit({ preventDefault() {} });
const element = (selector) => elements.get(selector);
console.log(JSON.stringify({
  sends,
  reveals: element("#progress").reveals,
  filename,
  bytes: downloadedBlob ? Buffer.from(await downloadedBlob.arrayBuffer()).toString("base64") : null,
  status: element("#status").textContent,
  tone: element("#status").dataset.tone,
  progress: element("#progress").textContent,
  disabledDuringExport,
  disabled: disabledState(),
  requests,
  injections
}));
