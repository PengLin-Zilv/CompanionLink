import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Pins the exact bytes the Replika export downloads. Each
// synthetic message ID names the rule it covers. Changing these bytes changes
// participants' data: update the golden only on purpose, with the CSV format in
// docs/technical-notes.md and a new version.
function runGolden(fromDate, toDate) {
  const child = spawnSync(process.execPath, ["tests/fixtures/replikaGolden.mjs", fromDate, toDate], {
    encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const result = JSON.parse(child.stdout);
  return { ...result, bytes: Buffer.from(result.bytes, "base64") };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const HEADER = "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID";
const GOLDEN_ROWS = [
  "2026-11-01 23:59:59,America/Los_Angeles,2026-11-02T07:59:59.999Z,2026-11-02 02:59:59,Rep,Last moment of To,Love,b1-last-in",
  "2026-11-01 01:30:00,America/Los_Angeles,2026-11-01T09:30:00.000Z,2026-11-01 04:30:00,Me,Los Angeles 1:30 PST,None,b1-dst-pst",
  "2026-11-01 01:30:00,America/Los_Angeles,2026-11-01T08:30:00.000Z,2026-11-01 03:30:00,Me,Los Angeles 1:30 PDT,None,b1-dst-pdt",
  "2026-10-31 23:30:00,America/Los_Angeles,2026-11-01T06:30:00.000Z,2026-11-01 01:30:00,Rep,Eastern 1:30 EST,None,b2-eastern-est",
  "2026-10-31 22:30:00,America/Los_Angeles,2026-11-01T05:30:00.000Z,2026-11-01 01:30:00,Rep,Eastern 1:30 EDT,None,b2-eastern-edt",
  "2026-10-31 13:00:00,America/Los_Angeles,2026-10-31T20:00:00.000Z,2026-10-31 16:00:00,Me,  padded  ,None,b2-padded",
  "2026-10-31 12:30:00,America/Los_Angeles,2026-10-31T19:30:00.000Z,2026-10-31 15:30:00,Me,Other nature,None,b2-other-nature",
  "2026-10-31 12:00:00,America/Los_Angeles,2026-10-31T19:00:00.000Z,2026-10-31 15:00:00,Rep,,None,b2-no-content",
  "2026-10-31 11:00:00,America/Los_Angeles,2026-10-31T18:00:00.000Z,2026-10-31 14:00:00,Me,,None,b2-image",
  "2026-10-31 10:00:00,America/Los_Angeles,2026-10-31T17:00:00.000Z,2026-10-31 13:00:00,Rep,你好，café 😊👍🏽,None,b2-unicode",
  "2026-10-31 09:00:00,America/Los_Angeles,2026-10-31T16:00:00.000Z,2026-10-31 12:00:00,Me,Typed \\n literally,None,b2-typed-backslash",
  "2026-10-31 08:00:00,America/Los_Angeles,2026-10-31T15:00:00.000Z,2026-10-31 11:00:00,Me,Numeric id and epoch time,None,4242",
  "2026-10-31 07:00:00,America/Los_Angeles,2026-10-31T14:00:00.000Z,2026-10-31 10:00:00,Rep,Offset timestamp,None,b2-offset",
  "2026-10-31 06:00:00,America/Los_Angeles,2026-10-31T13:00:00.000Z,2026-10-31 09:00:00,Rep,\"She said \"\"hi\"\", then left\",Like,b2-quote-comma",
  "2026-10-31 05:30:00,America/Los_Angeles,2026-10-31T12:30:00.000Z,2026-10-31 08:30:00,Me,\"Windows\r\nline\",None,b2-crlf",
  "2026-10-31 05:00:00,America/Los_Angeles,2026-10-31T12:00:00.000Z,2026-10-31 08:00:00,Me,\"Carriage\rreturn\",None,b2-cr",
  "2026-10-31 02:00:00,America/Los_Angeles,2026-10-31T09:00:00.000Z,2026-10-31 05:00:00,Rep,\"*smiles*\n\nHow was your day?\",Love,b3-paragraphs",
  "2026-10-31 01:15:30,America/Los_Angeles,2026-10-31T08:15:30.250Z,2026-10-31 04:15:30,Me,\"Line one\nLine two\",None,b3-lf",
  "2026-10-31 00:00:00,America/Los_Angeles,2026-10-31T07:00:00.000Z,2026-10-31 03:00:00,Rep,Good morning,None,b3-at-start"
];

test("golden Replika export downloads exactly the pinned bytes", () => {
  const result = runGolden("2026-10-31", "2026-11-01");
  assert.equal(result.bytes.toString("utf8"), `\uFEFF${[HEADER, ...GOLDEN_ROWS].join("\r\n")}\r\n`);
  assert.equal(sha256(result.bytes), "427109ad7a996080ec8f1e073200811199cf87ccab387dfbb768550c4898f060");
  assert.equal(result.filename, "P040.csv");
  // The requests decide which messages exist to be written: cursor, limit, stop.
  assert.deepEqual(result.historyRequests, [
    { chat_id: "f", limit: 1000 },
    { chat_id: "f", limit: 1000, last_message_id: "b1-dst-pdt" },
    { chat_id: "f", limit: 1000, last_message_id: "b2-cr" }
  ]);
});

test("golden Replika export of an empty window downloads only the BOM and header, 89 bytes", () => {
  const result = runGolden("2026-10-20", "2026-10-20");
  assert.equal(result.bytes.toString("utf8"), `\uFEFF${HEADER}\r\n`);
  assert.equal(result.bytes.length, 89);
  assert.equal(sha256(result.bytes), "ba072775a67ec22a2f7fc14a050421b9f6a29fc528cae17391fb4888d6816e71");
  assert.equal(result.filename, "P040.csv");
  assert.deepEqual(result.historyRequests, [
    { chat_id: "f", limit: 1000 },
    { chat_id: "f", limit: 1000, last_message_id: "b1-dst-pdt" },
    { chat_id: "f", limit: 1000, last_message_id: "b2-cr" },
    { chat_id: "f", limit: 1000, last_message_id: "b3-before-start" }
  ]);
});
