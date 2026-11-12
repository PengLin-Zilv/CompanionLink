import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Pins the exact bytes a Gemini export downloads through the real popup, against a fake
// gemini.google.com. Each synthetic turn names the rule it covers.
function runGemini(scenario = "ok") {
  const child = spawnSync(process.execPath, ["tests/fixtures/geminiExport.mjs", scenario], {
    encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const result = JSON.parse(child.stdout);
  return { ...result, bytes: result.bytes === null ? null : Buffer.from(result.bytes, "base64") };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const enabled = [false, false, false, false, false];
const BOM = String.fromCharCode(0xfeff);
const request = (cursor, accountPath = "") => ({
  endpoint: `https://gemini.google.com${accountPath}/_/BardChatUi/data/batchexecute`,
  chat: "c_fedcba9876543210", cursor, tokenSent: true, credentials: "include", cache: "no-store"
});
const SENTINELS = [
  "synthetic_at_token_0123456789:1730000000000", "boq_synthetic-web-uiserver_20261029.22_p0",
  "-7777777777777777777", "synthetic.person@example.invalid", "Synthetic Person"
];
const leaks = (value) => SENTINELS.filter((sentinel) => String(value).includes(sentinel));

const HEADER = "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction";
const GOLDEN_ROWS = [
  "2026-10-13 23:59:59,America/Los_Angeles,2026-10-14T06:59:59.999Z,2026-10-14 02:59:59,Gemini,Goodnight!,N/A",
  "2026-10-13 23:59:59,America/Los_Angeles,2026-10-14T06:59:59.999Z,2026-10-14 02:59:59,Me,Last moment of To,N/A",
  "2026-10-13 09:00:00,America/Los_Angeles,2026-10-13T16:00:00.000Z,2026-10-13 12:00:00,Gemini,What a lovely photo.,N/A",
  "2026-10-13 09:00:00,America/Los_Angeles,2026-10-13T16:00:00.000Z,2026-10-13 12:00:00,Me,,N/A",
  "2026-10-13 08:00:00,America/Los_Angeles,2026-10-13T15:00:00.000Z,2026-10-13 11:00:00,Gemini,Draft two: Alex,N/A",
  "2026-10-13 08:00:00,America/Los_Angeles,2026-10-13T15:00:00.000Z,2026-10-13 11:00:00,Me,Pick a name,N/A",
  "2026-10-13 07:31:00,America/Los_Angeles,2026-10-13T14:31:00.000Z,2026-10-13 10:31:00,Gemini,\"Here it is:\nhttp://googleusercontent.com/image_generation_content/0\",N/A",
  "2026-10-13 07:31:00,America/Los_Angeles,2026-10-13T14:31:00.000Z,2026-10-13 10:31:00,Me,Draw a cat,N/A",
  "2026-10-13 06:00:05,America/Los_Angeles,2026-10-13T13:00:05.123Z,2026-10-13 09:00:05,Gemini,\" It’s fine — 你好 😊\n\n**Two ideas:**\n- Walk, then read\n- Rest\",N/A",
  "2026-10-13 06:00:05,America/Los_Angeles,2026-10-13T13:00:05.123Z,2026-10-13 09:00:05,Me,\"She said \"\"hi\"\", then left\",N/A",
  "2026-10-13 00:00:00,America/Los_Angeles,2026-10-13T07:00:00.000Z,2026-10-13 03:00:00,Gemini,Morning!,N/A",
  "2026-10-13 00:00:00,America/Los_Angeles,2026-10-13T07:00:00.000Z,2026-10-13 03:00:00,Me,Good morning,N/A"
];
const GOLDEN_SHA256 = "2786880cf9c850bb3cbbfc28ed65ea4c5e23751c0e5444938c83afa7d8e119b5";

test("golden Gemini export downloads exactly the pinned bytes from the chat open at popup open", () => {
  const result = runGemini();
  assert.equal(result.bytes.toString("utf8"), `${BOM}${[HEADER, ...GOLDEN_ROWS].join("\r\n")}\r\n`);
  assert.equal(sha256(result.bytes), GOLDEN_SHA256);
  assert.equal(result.filename, "P040.csv");
  assert.equal(result.status, "Downloaded P040.csv");
  assert.equal(result.progress, "12 messages exported");
  assert.equal(result.sends[0].status, "Exporting Gemini chat history. Keep this window open until the file downloads; clicking outside it stops the export.");
  assert.deepEqual(result.disabledDuringExport, [true, true, true, true, true]);
  assert.deepEqual(result.disabled, enabled);
  // The Gemini popup has Replika's height, so it never scrolls.
  assert.equal(result.reveals, 0);
  // One injection into the tab the popup opened on reads two pages; the second page's
  // oldest turn is before From, so paging stops without asking for its cursor.
  assert.deepEqual(result.injections, [7]);
  assert.deepEqual(result.requests, [request(null), request("cursor-b")]);
  // Nothing from the setup script reaches the file or the popup.
  assert.deepEqual(leaks(result.bytes.toString("utf8")), []);
  assert.deepEqual(leaks(JSON.stringify(result.sends)), []);
  assert.deepEqual(leaks(result.status + result.progress), []);
});

test("a chat open under a second Google account downloads the same file through that account's path", () => {
  const result = runGemini("account");
  assert.equal(sha256(result.bytes), GOLDEN_SHA256);
  assert.deepEqual(result.injections, [7]);
  assert.deepEqual(result.requests, [request(null, "/u/1"), request("cursor-b", "/u/1")]);
});

test("signed out of Gemini downloads nothing and says to sign in", () => {
  const result = runGemini("signed-out");
  assert.equal(result.bytes, null);
  assert.equal(result.tone, "error");
  assert.equal(result.status, "Sign in to Gemini in this tab, refresh the page, then try again.");
  assert.equal(result.progress, "");
  assert.deepEqual(result.disabled, enabled);
  assert.deepEqual(result.requests, []);
  assert.deepEqual(leaks(JSON.stringify(result)), []);
});
