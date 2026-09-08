// Run the real popup modules with only browser/network boundaries replaced.
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : ["2026-09-09T12:00:00Z"]));
  }
};

let submit;
let downloadedBlob;
let filename;
const elements = new Map([
  ["#participant-id", { value: "040" }],
  ["#from-date", { value: "2026-09-07" }],
  ["#to-date", { value: "2026-09-07" }],
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

const message = (id, timestamp) => ({
  id, meta: { timestamp, nature: "Customer" }, content: { text: "Example" }
});
const batches = [
  [message("midday", "2026-09-07T12:00:00Z"), message("late", "2026-09-07T23:59:00Z")],
  [message("before", "2026-09-06T15:59:59Z"), message("early", "2026-09-07T06:59:59Z"),
    message("boundary", "2026-09-07T07:00:00Z")]
];
globalThis.WebSocket = class {
  constructor() { queueMicrotask(() => this.onopen()); }
  send(raw) {
    const request = JSON.parse(raw);
    let payload = {};
    if (request.event_name === "history") {
      // A setting change mid-export must not mix zones between batches.
      process.env.TZ = "America/New_York";
      payload = { messages: batches.shift() ?? [], message_reactions: [] };
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
  filename, csv: downloadedBlob ? await downloadedBlob.text() : null,
  status: elements.get("#status").textContent,
  progress: elements.get("#progress").textContent
}));
