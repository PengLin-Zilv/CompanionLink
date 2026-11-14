import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Pins the exact bytes a ChatGPT export downloads through the real popup, against a
// fake chatgpt.com. Each synthetic message ID names the rule it covers.
function runChatGpt(scenario = "ok") {
  const child = spawnSync(process.execPath, ["tests/fixtures/chatgptExport.mjs", scenario], {
    encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const result = JSON.parse(child.stdout);
  return { ...result, bytes: result.bytes === null ? null : Buffer.from(result.bytes, "base64") };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const enabled = [false, false, false, false, false];
const BOM = String.fromCharCode(0xfeff);
const CHAT = "https://chatgpt.com/backend-api/conversations/4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a";
const BEARER = "Bearer synthetic-access-token";
const request = (url, authorization) => ({ url, credentials: "include", cache: "no-store", authorization });
const SESSION_REQUEST = request("https://chatgpt.com/api/auth/session", null);
const SENTINELS = [
  "synthetic-access-token", "synthetic-session-token", "synthetic.person@example.invalid",
  "Synthetic Person", "synthetic-account-id"
];
const leaks = (value) => SENTINELS.filter((sentinel) => String(value).includes(sentinel));

const HEADER = "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction";
const GOLDEN_ROWS = [
  "2026-10-13 23:59:59,America/Los_Angeles,2026-10-14T06:59:59.999Z,2026-10-14 02:59:59,Me,Last moment of To,N/A",
  "2026-10-13 09:00:02,America/Los_Angeles,2026-10-13T16:00:02.000Z,2026-10-13 12:00:02,ChatGPT,\"Yes, loud and clear.\",N/A",
  "2026-10-13 09:00:10,America/Los_Angeles,2026-10-13T16:00:10.000Z,2026-10-13 12:00:10,Me,Can you hear me?,N/A",
  "2026-10-13 08:30:00,America/Los_Angeles,2026-10-13T15:30:00.000Z,2026-10-13 11:30:00,Me,,N/A",
  "2026-10-13 08:00:00,America/Los_Angeles,2026-10-13T15:00:00.000Z,2026-10-13 11:00:00,ChatGPT,\"Two ideas:\n- Walk\n- Read\",N/A",
  "2026-10-13 07:31:00,America/Los_Angeles,2026-10-13T14:31:00.000Z,2026-10-13 10:31:00,ChatGPT,It’s fine — 你好 😊,N/A",
  "2026-10-13 07:31:02,America/Los_Angeles,2026-10-13T14:31:02.250Z,2026-10-13 10:31:02,Me,\"She said \"\"hi\"\", then left\",N/A",
  "2026-10-13 06:00:05,America/Los_Angeles,2026-10-13T13:00:05.123Z,2026-10-13 09:00:05,ChatGPT, Here is what I found.,N/A",
  "2026-10-13 00:00:00,America/Los_Angeles,2026-10-13T07:00:00.000Z,2026-10-13 03:00:00,Me,Good morning,N/A"
];

test("golden ChatGPT export downloads exactly the pinned bytes from the chat open at popup open", () => {
  const result = runChatGpt();
  assert.equal(result.bytes.toString("utf8"), `${BOM}${[HEADER, ...GOLDEN_ROWS].join("\r\n")}\r\n`);
  assert.equal(sha256(result.bytes), "3b56c65974317d2774e33ca904fdc57b18045f353b62ef289602a74be80ccfca");
  assert.equal(result.filename, "P040.csv");
  assert.equal(result.status, "Downloaded P040.csv");
  assert.equal(result.progress, "9 messages exported");
  assert.equal(result.sends[0].status, "Exporting ChatGPT chat history. Keep this window open until the file downloads; clicking outside it stops the export.");
  assert.deepEqual(result.disabledDuringExport, [true, true, true, true, true]);
  assert.deepEqual(result.disabled, enabled);
  // The ChatGPT popup has Replika's height, so it never scrolls.
  assert.equal(result.reveals, 0);
  // One injection into the tab the popup opened on reads the session, then two pages;
  // the second page's oldest message is more than a day before From, so paging stops.
  assert.deepEqual(result.injections, [7]);
  assert.deepEqual(result.requests, [
    SESSION_REQUEST,
    request(`${CHAT}?num_turns=100&include_has_versions=true`, BEARER),
    request(`${CHAT}/messages?before=g-tools-answer&num_turns=100&include_has_versions=true`, BEARER)
  ]);
  // Nothing from the session reaches the file or the popup.
  assert.deepEqual(leaks(result.bytes.toString("utf8")), []);
  assert.deepEqual(leaks(JSON.stringify(result.sends)), []);
  assert.deepEqual(leaks(result.status + result.progress), []);
});

test("signed out of ChatGPT downloads nothing and says to sign in", () => {
  const result = runChatGpt("signed-out");
  assert.equal(result.bytes, null);
  assert.equal(result.tone, "error");
  assert.equal(result.status, "Sign in to ChatGPT in this tab, refresh the page, then try again.");
  assert.equal(result.progress, "");
  assert.deepEqual(result.disabled, enabled);
  assert.deepEqual(result.requests, [SESSION_REQUEST]);
  assert.deepEqual(leaks(JSON.stringify(result)), []);
});

test("exporting while ChatGPT is still writing a reply in the dates downloads nothing and says why", () => {
  const result = runChatGpt("replying");
  assert.equal(result.bytes, null);
  assert.equal(result.tone, "error");
  assert.equal(result.status, "ChatGPT has not finished its last reply in this chat. Wait for it to finish, or click Try again on the reply if it stopped, then export again.");
  assert.equal(result.progress, "");
  assert.deepEqual(result.disabled, enabled);
  // A token was read; none of the session reaches the popup.
  assert.deepEqual(leaks(JSON.stringify({ ...result, requests: undefined })), []);
});
