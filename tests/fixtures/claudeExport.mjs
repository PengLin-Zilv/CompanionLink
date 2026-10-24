// Claude export through the real popup: a fake claude.ai behind the real in-tab request
// function, the raw bytes handed to the download, and the state left behind.
// Usage: claudeExport.mjs <ok | signed-out | replying>
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : ["2026-10-15T12:00:00Z"]));
  }
};

const scenario = process.argv[2];
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
  // Claude never scrolls the status into view (the reveal is Kindroid-only).
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
  })
};
URL.createObjectURL = (blob) => { downloadedBlob = blob; return "blob:test"; };
URL.revokeObjectURL = () => {};

// Any later lookup sees another chat in another tab: the export must stay with the one
// open when the popup opened.
const C1 = "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const C2 = "9e8d7c6b-5a49-4382-9716-a5b4c3d2e1f0";
let tabQueries = 0;
const injections = [];
globalThis.chrome = {
  tabs: {
    query: async () => [tabQueries++ === 0
      ? { id: 7, url: `https://claude.ai/chat/${C1}` }
      : { id: 8, url: `https://claude.ai/chat/${C2}` }]
  },
  scripting: {
    executeScript: async ({ target, func, args }) => {
      injections.push(target.tabId);
      // Chrome rebuilds the function from its source in the page.
      return [{ result: await new Function(`return (${func})`)()(...args) }];
    }
  }
};

const ROOT = "00000000-0000-4000-8000-000000000000";
const text = (value, extra) => ({ type: "text", text: value, ...extra });
const message = (uuid, parent, sender, createdAt, content) => ({
  uuid, parent_message_uuid: parent, sender, created_at: createdAt, content
});
// The study window, Oct 13 in Los Angeles, is 2026-10-13T07:00Z to 2026-10-14T07:00Z.
// The visible branch, oldest first, with one abandoned retry inside the window.
const chat = [
  message("c-april", ROOT, "human", "2026-04-24T13:00:28.782890Z", [text("Hello from April")]),
  message("c-april-reply", "c-april", "assistant", "2026-04-24T13:00:31.715698Z", [text("Hi!")]),
  message("c-before", "c-april-reply", "human", "2026-10-13T06:59:58.000Z", [text("Too early")]),
  message("c-before-reply", "c-before", "assistant", "2026-10-13T06:59:59.999Z", [text("Still too early")]),
  message("c-at-start", "c-before-reply", "human", "2026-10-13T07:00:00.000Z", [text("Good morning")]),
  message("c-tools", "c-at-start", "assistant", "2026-10-13T13:00:05.123456+00:00", [
    text(" Let me check."),
    { type: "tool_use", name: "web_search", input: { query: "weather" } },
    { type: "tool_result", content: [{ type: "text", text: "Sunny" }] },
    text("Found it."),
    { type: "token_budget" }
  ]),
  message("c-quote", "c-tools", "human", "2026-10-13T14:30:15.250Z", [text("She said \"hi\", then left")]),
  message("c-abandoned", "c-quote", "assistant", "2026-10-13T14:30:20.000Z", [text("First try")]),
  message("c-cited", "c-quote", "assistant", "2026-10-13T14:31:00.000Z", [
    text("It’s fine", { citations: [{ url: "https://example.invalid/a" }] }),
    text(" — 你好 😊")
  ]),
  { ...message("c-file", "c-cited", "human", "2026-10-13T15:00:00.000Z", []), files: [{ file_name: "photo.jpg" }] },
  message("c-lines", "c-file", "assistant", "2026-10-13T16:00:00.000Z", [text("Two ideas:\n- Walk\n- Read")]),
  message("c-last-in", "c-lines", "human", "2026-10-14T06:59:59.999Z", [text("Last moment of To")]),
  message("c-at-end", "c-last-in", "assistant", "2026-10-14T07:00:00.000Z", [text("At the end boundary")])
];
// replying: as seen live, the leaf stays on the previous reply and the newest message
// hangs below it.
const pending = message("c-pending", "c-at-end", "human", "2026-10-15T11:59:30.000Z", [text("Write an essay")]);
const conversation = {
  uuid: C1,
  name: "Study chat",
  current_leaf_message_uuid: "c-at-end",
  chat_messages: scenario === "replying" ? [...chat, pending] : chat
};

const detail = `/chat_conversations/${C1}?tree=True&rendering_mode=messages&render_all_tools=true`;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" }
});
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
  requests.push({ url, credentials: init.credentials, cache: init.cache });
  if (url === "https://claude.ai/api/organizations") {
    return scenario === "signed-out"
      ? json({ type: "error", error: { type: "authentication_error" } }, 401)
      : json([{ uuid: "org-a", name: "Personal" }, { uuid: "org-b", name: "University" }]);
  }
  if (url === `https://claude.ai/api/organizations/org-a${detail}`) return json({ type: "error", error: { type: "not_found_error" } }, 404);
  if (url === `https://claude.ai/api/organizations/org-b${detail}`) return json(conversation);
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
