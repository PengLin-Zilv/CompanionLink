// ChatGPT export through the real popup: a fake chatgpt.com behind the real in-tab
// function, the raw bytes handed to the download, and the state left behind.
// Usage: chatgptExport.mjs <ok | signed-out | replying>
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
  // ChatGPT never scrolls the status into view (the reveal is Kindroid-only).
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
const C1 = "4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a";
const C2 = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";
let tabQueries = 0;
const injections = [];
globalThis.chrome = {
  tabs: {
    query: async () => [tabQueries++ === 0
      ? { id: 7, url: `https://chatgpt.com/c/${C1}` }
      : { id: 8, url: `https://chatgpt.com/c/${C2}` }]
  },
  scripting: {
    executeScript: async ({ target, func, args }) => {
      injections.push(target.tabId);
      // Chrome rebuilds the function from its source in the page.
      return [{ result: await new Function(`return (${func})`)()(...args) }];
    }
  }
};

// The same synthetic shapes as tests/chatgptClient.test.js.
const seconds = (iso) => (iso === null ? null : Date.parse(iso) / 1000);
const message = (id, role, iso, content, extra) => ({
  id, author: { role, name: null, metadata: {} }, create_time: seconds(iso), update_time: seconds(iso),
  content, status: "finished_successfully", end_turn: null, weight: 1,
  metadata: {}, recipient: "all", channel: role === "assistant" ? "final" : null, ...extra
});
const typed = (...parts) => ({ content_type: "text", parts });
const multi = (...parts) => ({ content_type: "multimodal_text", parts });
const transcript = (text) => ({ content_type: "audio_transcription", text, direction: "in" });
const image = () => ({ content_type: "image_asset_pointer", asset_pointer: "sediment://synthetic", width: 1, height: 1 });
const audio = () => ({ content_type: "audio_asset_pointer", asset_pointer: "sediment://synthetic-audio" });
const video = () => ({ content_type: "real_time_user_audio_video_asset_pointer" });
const page = (messages, hasPrevious) => ({
  messages,
  page_info: {
    start_cursor: messages[0].id, end_cursor: messages.at(-1).id,
    has_previous_page: hasPrevious, has_next_page: false
  }
});
const SESSION = {
  WARNING_BANNER: "synthetic", accessToken: "synthetic-access-token",
  account: { id: "synthetic-account-id" },
  user: { id: "user-synthetic", name: "Synthetic Person", email: "synthetic.person@example.invalid" },
  authProvider: "synthetic", expires: "2026-11-15T12:00:00.000Z",
  sessionToken: "synthetic-session-token", statsigContext: {}, marketingEligibility: {}
};

// The study window, Oct 13 in Los Angeles, is 2026-10-13T07:00Z to 2026-10-14T07:00Z.
// Page A, the newest part, oldest first. Its oldest row candidate is in the dates, so
// the older page is asked for.
const pageA = {
  title: "Synthetic chat", conversation_id: C1, current_node: "g-at-end", gizmo_id: null,
  is_temporary_chat: false, is_archived: false,
  ...page([
    message("g-tools-answer", "assistant", null, typed(" Here is what I found."),
      { create_time: seconds("2026-10-13T13:00:05.123Z") + 0.000456 }),
    message("g-quote", "user", "2026-10-13T14:31:02.250Z", typed("She said \"hi\", then left")),
    // The reply is timed before its prompt, as observed; list order is kept.
    message("g-reply", "assistant", "2026-10-13T14:31:00.000Z", typed("It’s fine — 你好 😊")),
    message("g-memory", "assistant", "2026-10-13T14:31:01.000Z", { content_type: "model_editable_context", model_set_context: "synthetic" }),
    message("g-lines", "assistant", "2026-10-13T15:00:00.000Z", typed("Two ideas:\n- Walk\n- Read"),
      scenario === "replying" ? { status: "in_progress" } : {}),
    message("g-thoughts", "assistant", "2026-10-13T15:00:30.000Z", { content_type: "thoughts", thoughts: [{ summary: "s", content: "c" }] }),
    message("g-image", "user", "2026-10-13T15:30:00.000Z", multi(image())),
    message("g-voice-user", "user", "2026-10-13T16:00:10.000Z", multi(transcript("Can you hear me?"), audio(), video())),
    message("g-voice-reply", "assistant", "2026-10-13T16:00:02.000Z", multi(audio(), transcript("Yes, loud and clear."))),
    message("g-empty", "assistant", "2026-10-13T16:00:03.000Z", typed("")),
    message("g-last-in", "user", "2026-10-14T06:59:59.999Z", typed("Last moment of To")),
    message("g-at-end", "assistant", "2026-10-14T07:00:00.000Z", typed("At the end boundary"))
  ], true)
};
// Page B, the older part. g-old, its oldest row candidate, is more than a day before
// From, so paging stops here although an older page exists.
const pageB = page([
  message("g-old", "user", "2026-10-11T12:00:00.000Z", typed("Hello from last week")),
  message("g-system", "system", null, typed(""), { create_time: null, weight: 0, metadata: { is_visually_hidden_from_conversation: true } }),
  message("g-before", "user", "2026-10-13T06:59:59.000Z", typed("Too early")),
  message("g-at-start", "user", "2026-10-13T07:00:00.000Z", typed("Good morning")),
  message("g-tool-call", "assistant", "2026-10-13T13:00:01.000Z", typed("{\"query\":\"synthetic\"}"), { recipient: "web.run" }),
  message("g-tool-result", "tool", "2026-10-13T13:00:03.000Z", typed("Synthetic results"))
], true);

const chat = `https://chatgpt.com/backend-api/conversations/${C1}`;
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
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
  requests.push({ url, credentials: init.credentials, cache: init.cache, authorization: init.headers?.Authorization ?? null });
  // signed-out: no access token, but the rest of a session, so a leak of it would show.
  if (url === "https://chatgpt.com/api/auth/session") return json(scenario === "signed-out" ? { ...SESSION, accessToken: undefined } : SESSION);
  if (url === `${chat}?num_turns=100&include_has_versions=true`) return json(pageA);
  if (url === `${chat}/messages?before=g-tools-answer&num_turns=100&include_has_versions=true`) return json(pageB);
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
