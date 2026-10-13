import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Pins the exact bytes a Kindroid export downloads through the real popup, against a
// fake Kindroid API. Each synthetic message ID names the rule it covers.
function runKindroid(scenario = "ok") {
  const child = spawnSync(process.execPath, ["tests/fixtures/kindroidExport.mjs", scenario], {
    encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const result = JSON.parse(child.stdout);
  return { ...result, bytes: result.bytes === null ? null : Buffer.from(result.bytes, "base64") };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const enabled = [false, false, false, false, false];
const ENDPOINT = "https://api.kindroid.ai/v1/get-chat-messages";

const HEADER = "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID";
const GOLDEN_ROWS = [
  "2026-09-29 23:59:59,America/Los_Angeles,2026-09-30T06:59:59.999Z,2026-09-30 02:59:59,Kin,Last moment of To,N/A,k-last-in",
  "2026-09-29 09:00:00,America/Los_Angeles,2026-09-29T16:00:00.000Z,2026-09-29 12:00:00,Kin,It’s fine — 你好 😊,N/A,k-unicode",
  "2026-09-29 08:00:00,America/Los_Angeles,2026-09-29T15:00:00.000Z,2026-09-29 11:00:00,Me,,N/A,k-image",
  "2026-09-29 07:30:15,America/Los_Angeles,2026-09-29T14:30:15.250Z,2026-09-29 10:30:15,Me,\"She said \"\"hi\"\", then left\",N/A,k-quote",
  "2026-09-29 06:00:00,America/Los_Angeles,2026-09-29T13:00:00.000Z,2026-09-29 09:00:00,Kin,\"*smiles*\n\nHow was your day?\",N/A,k-paragraphs",
  "2026-09-29 00:00:00,America/Los_Angeles,2026-09-29T07:00:00.000Z,2026-09-29 03:00:00,Me,Good morning,N/A,k-at-start"
];

test("golden Kindroid export downloads exactly the pinned bytes and clears the key", () => {
  const result = runKindroid();
  assert.equal(result.bytes.toString("utf8"), `\uFEFF${[HEADER, ...GOLDEN_ROWS].join("\r\n")}\r\n`);
  assert.equal(sha256(result.bytes), "43a08e1ee3610692abb0b1a1c8ca8e870fd57b0ba931eb0383b94b0b6dcb8410");
  assert.equal(result.filename, "P040.csv");
  assert.equal(result.status, "Downloaded P040.csv (chat with B)");
  assert.equal(result.progress, "6 messages exported");
  assert.equal(result.keyAfter, "");
  // Clicking outside the popup closes it and stops the export, so say so throughout.
  assert.equal(result.sends[0].status,
    "Exporting Kindroid chat history. Keep this window open until the file downloads; clicking outside it stops the export.");
  assert.deepEqual(result.disabledDuringExport, [true, true, true, true, true]);
  assert.deepEqual(result.disabled, enabled);
  // The trimmed key travels only in the header; the window starts the walk.
  assert.deepEqual(result.requests, [
    { origin: ENDPOINT, params: { ai_id: "AI1", limit: "1" }, auth: "Bearer kn_fixturekey" },
    {
      origin: ENDPOINT,
      params: { ai_id: "AI1", limit: "100", start_after_timestamp: String(Date.parse("2026-09-29T07:00:00.000Z") - 1) },
      auth: "Bearer kn_fixturekey"
    }
  ]);
});

test("a Kindroid error downloads nothing, shows the error and still clears the key", () => {
  const result = runKindroid("http401");
  assert.equal(result.bytes, null);
  assert.equal(result.tone, "error");
  assert.match(result.status, /did not accept this API key/);
  assert.equal(result.progress, "");
  assert.equal(result.keyAfter, "");
  assert.deepEqual(result.disabled, enabled);
});

test("after a 429, a second submit in the same popup waits out the window and says so", () => {
  const result = runKindroid("retry429");
  assert.match(result.firstStatus, /limiting requests/);
  assert.equal(result.status, "Downloaded P040.csv (chat with B)");
  assert.deepEqual(result.sends.map((send) => send.at), [0, 31000, 31000]);
  assert.equal(result.sends[1].progress, "0 messages so far. Waiting 31 s (Kindroid allows 10 requests every 30 seconds).");
});

test("a missing or malformed key is rejected before any request and kept for correction", () => {
  const zeroWidthSpace = String.fromCharCode(0x200b);
  for (const [scenario, key] of [["nokey", ""], ["notkn", "abc123"], ["zerowidth", `kn_abc${zeroWidthSpace}def`]]) {
    const result = runKindroid(scenario);
    assert.equal(result.bytes, null, scenario);
    assert.equal(result.tone, "error", scenario);
    assert.match(result.status, /starts with kn_/, scenario);
    assert.deepEqual(result.requests, [], scenario);
    assert.equal(result.keyAfter, key, scenario);
    assert.deepEqual(result.disabled, enabled, scenario);
  }
});
