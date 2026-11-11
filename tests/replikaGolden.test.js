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

const HEADER = "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction";
const GOLDEN_ROWS = [
  "2026-11-01 23:59:59,America/Los_Angeles,2026-11-02T07:59:59.999Z,2026-11-02 02:59:59,Rep,Last moment of To,Love",
  "2026-11-01 01:30:00,America/Los_Angeles,2026-11-01T09:30:00.000Z,2026-11-01 04:30:00,Me,Los Angeles 1:30 PST,None",
  "2026-11-01 01:30:00,America/Los_Angeles,2026-11-01T08:30:00.000Z,2026-11-01 03:30:00,Me,Los Angeles 1:30 PDT,None",
  "2026-10-31 23:30:00,America/Los_Angeles,2026-11-01T06:30:00.000Z,2026-11-01 01:30:00,Rep,Eastern 1:30 EST,None",
  "2026-10-31 22:30:00,America/Los_Angeles,2026-11-01T05:30:00.000Z,2026-11-01 01:30:00,Rep,Eastern 1:30 EDT,None",
  "2026-10-31 13:00:00,America/Los_Angeles,2026-10-31T20:00:00.000Z,2026-10-31 16:00:00,Me,  padded  ,None",
  "2026-10-31 12:30:00,America/Los_Angeles,2026-10-31T19:30:00.000Z,2026-10-31 15:30:00,Me,Other nature,None",
  "2026-10-31 12:00:00,America/Los_Angeles,2026-10-31T19:00:00.000Z,2026-10-31 15:00:00,Rep,,None",
  "2026-10-31 11:00:00,America/Los_Angeles,2026-10-31T18:00:00.000Z,2026-10-31 14:00:00,Me,,None",
  "2026-10-31 10:00:00,America/Los_Angeles,2026-10-31T17:00:00.000Z,2026-10-31 13:00:00,Rep,你好，café 😊👍🏽,None",
  "2026-10-31 09:00:00,America/Los_Angeles,2026-10-31T16:00:00.000Z,2026-10-31 12:00:00,Me,Typed \\n literally,None",
  "2026-10-31 08:00:00,America/Los_Angeles,2026-10-31T15:00:00.000Z,2026-10-31 11:00:00,Me,Numeric id and epoch time,None",
  "2026-10-31 07:00:00,America/Los_Angeles,2026-10-31T14:00:00.000Z,2026-10-31 10:00:00,Rep,Offset timestamp,None",
  "2026-10-31 06:00:00,America/Los_Angeles,2026-10-31T13:00:00.000Z,2026-10-31 09:00:00,Rep,\"She said \"\"hi\"\", then left\",Like",
  "2026-10-31 05:30:00,America/Los_Angeles,2026-10-31T12:30:00.000Z,2026-10-31 08:30:00,Me,\"Windows\r\nline\",None",
  "2026-10-31 05:00:00,America/Los_Angeles,2026-10-31T12:00:00.000Z,2026-10-31 08:00:00,Me,\"Carriage\rreturn\",None",
  "2026-10-31 02:00:00,America/Los_Angeles,2026-10-31T09:00:00.000Z,2026-10-31 05:00:00,Rep,\"*smiles*\n\nHow was your day?\",Love",
  "2026-10-31 01:15:30,America/Los_Angeles,2026-10-31T08:15:30.250Z,2026-10-31 04:15:30,Me,\"Line one\nLine two\",None",
  "2026-10-31 00:00:00,America/Los_Angeles,2026-10-31T07:00:00.000Z,2026-10-31 03:00:00,Rep,Good morning,None"
];

test("golden Replika export downloads exactly the pinned bytes", () => {
  const result = runGolden("2026-10-31", "2026-11-01");
  assert.equal(result.bytes.toString("utf8"), `\uFEFF${[HEADER, ...GOLDEN_ROWS].join("\r\n")}\r\n`);
  assert.equal(sha256(result.bytes), "969200fe435b165fabba07acdcbba410f62b5651cb47f35b43b031757d511a10");
  assert.equal(result.filename, "P040.csv");
  // The requests decide which messages exist to be written: cursor, limit, stop.
  assert.deepEqual(result.historyRequests, [
    { chat_id: "f", limit: 1000 },
    { chat_id: "f", limit: 1000, last_message_id: "b1-dst-pdt" },
    { chat_id: "f", limit: 1000, last_message_id: "b2-cr" }
  ]);
});

test("golden Replika export of an empty window downloads only the BOM and header, 86 bytes", () => {
  const result = runGolden("2026-10-20", "2026-10-20");
  assert.equal(result.bytes.toString("utf8"), `\uFEFF${HEADER}\r\n`);
  assert.equal(result.bytes.length, 86);
  assert.equal(sha256(result.bytes), "3a2909ab5e756b5f79b1d382e01a74266ed9bc2f3cf5567e316b9399c3016e8f");
  assert.equal(result.filename, "P040.csv");
  assert.deepEqual(result.historyRequests, [
    { chat_id: "f", limit: 1000 },
    { chat_id: "f", limit: 1000, last_message_id: "b1-dst-pdt" },
    { chat_id: "f", limit: 1000, last_message_id: "b2-cr" },
    { chat_id: "f", limit: 1000, last_message_id: "b3-before-start" }
  ]);
});
