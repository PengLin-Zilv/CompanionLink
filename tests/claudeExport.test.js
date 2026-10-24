import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Pins the exact bytes a Claude export downloads through the real popup, against a
// fake claude.ai. Each synthetic message ID names the rule it covers.
function runClaude(scenario = "ok") {
  const child = spawnSync(process.execPath, ["tests/fixtures/claudeExport.mjs", scenario], {
    encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const result = JSON.parse(child.stdout);
  return { ...result, bytes: result.bytes === null ? null : Buffer.from(result.bytes, "base64") };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const enabled = [false, false, false, false, false];
const BOM = String.fromCharCode(0xfeff);
const ORGS = "https://claude.ai/api/organizations";
const chatUrl = (org) =>
  `${ORGS}/${org}/chat_conversations/6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f?tree=True&rendering_mode=messages&render_all_tools=true`;
const request = (url) => ({ url, credentials: "include", cache: "no-store" });

const HEADER = "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID";
const GOLDEN_ROWS = [
  "2026-10-13 23:59:59,America/Los_Angeles,2026-10-14T06:59:59.999Z,2026-10-14 02:59:59,Me,Last moment of To,N/A,c-last-in",
  "2026-10-13 09:00:00,America/Los_Angeles,2026-10-13T16:00:00.000Z,2026-10-13 12:00:00,Claude,\"Two ideas:\n- Walk\n- Read\",N/A,c-lines",
  "2026-10-13 08:00:00,America/Los_Angeles,2026-10-13T15:00:00.000Z,2026-10-13 11:00:00,Me,,N/A,c-file",
  "2026-10-13 07:31:00,America/Los_Angeles,2026-10-13T14:31:00.000Z,2026-10-13 10:31:00,Claude,It’s fine — 你好 😊,N/A,c-cited",
  "2026-10-13 07:30:15,America/Los_Angeles,2026-10-13T14:30:15.250Z,2026-10-13 10:30:15,Me,\"She said \"\"hi\"\", then left\",N/A,c-quote",
  "2026-10-13 06:00:05,America/Los_Angeles,2026-10-13T13:00:05.123Z,2026-10-13 09:00:05,Claude,\" Let me check.\n\nFound it.\",N/A,c-tools",
  "2026-10-13 00:00:00,America/Los_Angeles,2026-10-13T07:00:00.000Z,2026-10-13 03:00:00,Me,Good morning,N/A,c-at-start"
];

test("golden Claude export downloads exactly the pinned bytes from the chat open at popup open", () => {
  const result = runClaude();
  assert.equal(result.bytes.toString("utf8"), `${BOM}${[HEADER, ...GOLDEN_ROWS].join("\r\n")}\r\n`);
  assert.equal(sha256(result.bytes), "0e60da08b42d858f83e2ad5c77409bcf1738927a6e4f6b6e3542a842bebddb0e");
  assert.equal(result.filename, "P040.csv");
  assert.equal(result.status, "Downloaded P040.csv");
  assert.equal(result.progress, "7 messages exported");
  assert.equal(result.sends[0].status, "Exporting Claude chat history. Keep this window open until the file downloads.");
  assert.deepEqual(result.disabledDuringExport, [true, true, true, true, true]);
  assert.deepEqual(result.disabled, enabled);
  // The Claude popup has Replika's height, so it never scrolls.
  assert.equal(result.reveals, 0);
  // The chat is not in the first organization (404), so the second one is asked. Every
  // request runs in the tab the popup opened on, with its sign-in and uncached.
  assert.deepEqual(result.requests, [request(ORGS), request(chatUrl("org-a")), request(chatUrl("org-b"))]);
  assert.deepEqual(result.injections, [7, 7, 7]);
});

test("signed out of Claude downloads nothing and says to sign in", () => {
  const result = runClaude("signed-out");
  assert.equal(result.bytes, null);
  assert.equal(result.tone, "error");
  assert.equal(result.status, "Sign in to Claude in this tab, refresh the page, then try again.");
  assert.equal(result.progress, "");
  assert.deepEqual(result.disabled, enabled);
  assert.deepEqual(result.requests, [request(ORGS)]);
});

test("exporting before Claude finished its last reply downloads nothing and says why", () => {
  const result = runClaude("replying");
  assert.equal(result.bytes, null);
  assert.equal(result.tone, "error");
  assert.equal(result.status, "Claude has not finished its last reply in this chat. Wait for it to finish, or click Retry in Claude if it stopped, then try again.");
  assert.equal(result.progress, "");
  assert.deepEqual(result.disabled, enabled);
});
