// Golden Replika export: the real popup modules, a fixed synthetic v17 transcript,
// and the raw bytes handed to the download. Usage: replikaGolden.mjs <from> <to>
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : ["2026-11-03T12:00:00Z"]));
  }
};

const [fromDate, toDate] = process.argv.slice(2);
let submit;
let downloadedBlob;
let filename;
const elements = new Map([
  ["#participant-id", { value: "040" }],
  ["#from-date", { value: fromDate }],
  ["#to-date", { value: toDate }],
  ["#api-key", { value: "" }],
  ["#export-button", {}],
  ["#status", { dataset: {} }],
  ["#progress", {}],
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

globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 1, url: "https://my.replika.com/chat" }],
    sendMessage: (_id, _message, callback) => callback({ initMessage: JSON.stringify({
      event_name: "init", payload: {}, token: "fixture",
      auth: { user_id: "10", auth_token: "fixture", device_id: "fixture" }
    }) })
  },
  scripting: { executeScript: async () => {} },
  runtime: {}
};

const message = (id, timestamp, nature, text) => ({ id, meta: { timestamp, nature }, content: { text } });

// Newest batch first; each batch oldest first, as v17 serves them. The study
// window, Oct 31 to Nov 1 in Los Angeles, is 2026-10-31T07:00Z to 2026-11-02T08:00Z.
const batches = [
  {
    messages: [
      message("b1-dst-pdt", "2026-11-01T08:30:00.000Z", "Customer", "Los Angeles 1:30 PDT"),
      message("b1-dst-pst", "2026-11-01T09:30:00.000Z", "Customer", "Los Angeles 1:30 PST"),
      message("b1-last-in", "2026-11-02T07:59:59.999Z", "Robot", "Last moment of To"),
      message("b1-at-end", "2026-11-02T08:00:00.000Z", "Customer", "At the end boundary")
    ],
    message_reactions: [{ message_id: "b1-last-in", reaction: "Love" }]
  },
  {
    messages: [
      message("b2-cr", "2026-10-31T12:00:00.000Z", "Customer", "Carriage\rreturn"),
      message("b2-crlf", "2026-10-31T12:30:00.000Z", "Customer", "Windows\r\nline"),
      message("b2-quote-comma", "2026-10-31T13:00:00.000Z", "Robot", "She said \"hi\", then left"),
      message("b2-offset", "2026-10-31T07:00:00.000-07:00", "Robot", "Offset timestamp"),
      message(4242, Date.parse("2026-10-31T15:00:00.000Z"), "Customer", "Numeric id and epoch time"),
      message("b2-typed-backslash", "2026-10-31T16:00:00.000Z", "Customer", "Typed \\n literally"),
      message("b2-unicode", "2026-10-31T17:00:00.000Z", "Robot", "你好，café 😊👍🏽"),
      {
        id: "b2-image", meta: { timestamp: "2026-10-31T18:00:00.000Z", nature: "Customer" },
        content: { type: "images", text: "", images: ["https://example.invalid/image.jpg"], caption: "A synthetic caption" }
      },
      { id: "b2-no-content", meta: { timestamp: "2026-10-31T19:00:00.000Z", nature: "Robot" } },
      message("b2-other-nature", "2026-10-31T19:30:00.000Z", "Unknown", "Other nature"),
      message("b2-padded", "2026-10-31T20:00:00.000Z", "Customer", "  padded  "),
      message("b2-eastern-edt", "2026-11-01T05:30:00.000Z", "Robot", "Eastern 1:30 EDT"),
      message("b2-eastern-est", "2026-11-01T06:30:00.000Z", "Robot", "Eastern 1:30 EST"),
      message("b1-dst-pdt", "2026-11-01T08:30:00.000Z", "Customer", "Duplicate copy must not appear")
    ],
    message_reactions: [
      { message_id: "b2-quote-comma", reaction: "Like" },
      { message_id: "b1-dst-pst", reaction: "Funny" }
    ]
  },
  {
    messages: [
      message("b3-before-start", "2026-10-31T06:59:59.999Z", "Customer", "Too early"),
      message("b3-at-start", "2026-10-31T07:00:00.000Z", "Robot", "Good morning"),
      message("b3-lf", "2026-10-31T08:15:30.250Z", "Customer", "Line one\nLine two"),
      message("b3-paragraphs", "2026-10-31T09:00:00.000Z", "Robot", "*smiles*\n\nHow was your day?")
    ],
    message_reactions: [{ message_id: "b3-paragraphs", reaction: "Love" }]
  }
];

const historyRequests = [];
globalThis.WebSocket = class {
  constructor() { queueMicrotask(() => this.onopen()); }
  send(raw) {
    const request = JSON.parse(raw);
    let payload = {};
    if (request.event_name === "history") {
      historyRequests.push(request.payload);
      payload = batches.shift() ?? { messages: [], message_reactions: [] };
    }
    queueMicrotask(() => this.onmessage({ data: JSON.stringify({
      event_name: request.event_name, token: "fixture", payload
    }) }));
  }
  close() {}
};

await import("../../extension/export.js");
await submit({ preventDefault() {} });
console.log(JSON.stringify({
  filename,
  type: downloadedBlob?.type,
  bytes: downloadedBlob ? Buffer.from(await downloadedBlob.arrayBuffer()).toString("base64") : null,
  status: elements.get("#status").textContent,
  progress: elements.get("#progress").textContent,
  historyRequests
}));
