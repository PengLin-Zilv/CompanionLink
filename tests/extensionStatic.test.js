import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getReplikaInitMessage, isReplikaTabUrl } from "../extension/sessionBridge.js";

test("extension manifest exposes only the MVP browser surfaces", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "CompanionLink");
  assert.equal(manifest.action.default_popup, "export.html");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.deepEqual(manifest.host_permissions ?? [], []);
  assert.deepEqual(manifest.optional_host_permissions ?? [], []);
});

test("session capture is registered only on the Replika chat host", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));

  assert.deepEqual(manifest.content_scripts, [{
    matches: ["https://my.replika.com/*"],
    js: ["contentScript.js"],
    run_at: "document_start"
  }]);
});

test("page bridge is exposed only to the Replika chat host", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));

  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ["pageBridge.js"],
    matches: ["https://my.replika.com/*"]
  }]);
});

test("manifest and package versions match and are valid for Chrome", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
  const pkg = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(
    manifest.version,
    pkg.version,
    "extension/manifest.json and package.json must declare the same version"
  );

  const parts = manifest.version.split(".");
  assert.ok(parts.length >= 1 && parts.length <= 4, "version needs one to four parts");
  assert.ok(parts.some((part) => part !== "0"), "version must not be all zero");

  for (const part of parts) {
    assert.match(part, /^(0|[1-9][0-9]*)$/, `"${part}" must be an integer without leading zeros`);
    assert.ok(Number(part) <= 65535, `"${part}" must not exceed 65535`);
  }
});

test("session bridge accepts HTTPS pages on the exact Replika chat host", () => {
  for (const url of [
    "https://my.replika.com/",
    "https://my.replika.com/chat?view=messages#latest",
    "https://my.replika.com/login",
    "https://MY.REPLIKA.COM/"
  ]) {
    assert.equal(isReplikaTabUrl(url), true, url);
  }
});

test("session bridge rejects non-chat hosts, lookalikes and non-HTTPS URLs", () => {
  for (const url of [
    "https://replika.com/",
    "https://help.replika.com/",
    "https://other.my.replika.com/",
    "https://replika.ai/",
    "https://my.replika.ai/",
    "https://ws.replika.ai/v17",
    "https://my.replika.com.example.com/",
    "https://my.replika.com@example.com/",
    "https://example.com/my.replika.com",
    "http://my.replika.com/",
    "wss://my.replika.com/",
    "chrome://extensions",
    "not a URL",
    undefined
  ]) {
    assert.equal(isReplikaTabUrl(url), false, String(url));
  }
});

test("session lookup refuses other Replika pages before injection or messaging", async (t) => {
  const originalChrome = globalThis.chrome;
  t.after(() => {
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  });
  const calls = [];
  globalThis.chrome = {
    tabs: {
      query: async () => [{ id: 1, url: "https://help.replika.com/" }],
      sendMessage: (_tabId, _message, respond) => {
        calls.push("sendMessage");
        respond({ initMessage: "test-session" });
      }
    },
    scripting: { executeScript: async () => calls.push("executeScript") },
    runtime: {}
  };

  await assert.rejects(getReplikaInitMessage(), /Open Replika in the active tab/);
  assert.deepEqual(calls, []);
});

test("extension UI and bridge files are present", async () => {
  const requiredFiles = [
    "extension/export.html",
    "extension/export.js",
    "extension/sessionBridge.js",
    "extension/contentScript.js",
    "extension/pageBridge.js",
    "extension/v17Client.js",
    "extension/studyWindow.js",
    "extension/csvWriter.js"
  ];

  for (const file of requiredFiles) {
    const content = await readFile(file, "utf8");
    assert.ok(content.length > 0, `${file} should not be empty`);
  }
});

test("extension UI uses participant-friendly wording", async () => {
  const html = await readFile("extension/export.html", "utf8");

  assert.match(html, /<title>CompanionLink<\/title>/);
  assert.match(html, /<h1>CompanionLink<\/h1>/);
  assert.match(html, /<label for="participant-id">Participant ID<\/label>/);
  assert.match(html, /placeholder="Example: 040"/);
  assert.match(html, /Enter the participant ID, for example 040\./);
  assert.match(html, /The file will download as P040\.csv\./);
  assert.match(html, />Export Chat Log<\/button>/);
  assert.doesNotMatch(html, /\bPID\b/);
});

test("the Kindroid key field is hidden by default, masked and never autofilled", async () => {
  const html = await readFile("extension/export.html", "utf8");

  assert.match(html, /<p id="chat" class="hint" hidden><\/p>/);
  assert.match(html, /<div id="kindroid-key" hidden>/);
  assert.match(html, /<input id="api-key"[^>]*type="password"[^>]*autocomplete="off"/);
  // A hidden required input would block every Replika submit.
  assert.doesNotMatch(html, /<input id="api-key"[^>]*required/);
  assert.match(html, /Your key is never saved and is cleared when the export ends\./);
});

test("extension UI requires From and To dates and submits one study window", async () => {
  const html = await readFile("extension/export.html", "utf8");
  const script = await readFile("extension/export.js", "utf8");

  assert.match(html, /<label for="from-date">From date<\/label>/);
  assert.match(html, /<input id="from-date"[^>]*type="date"[^>]*required>/);
  assert.match(html, /<label for="to-date">To date<\/label>/);
  assert.match(html, /<input id="to-date"[^>]*type="date"[^>]*required>/);
  assert.doesNotMatch(html, /date-range-hint/);
  assert.doesNotMatch(html, /Both dates are included\./);
  assert.doesNotMatch(html, /study-start-date/);
  assert.match(script, /import \{ createStudyWindow \} from "\.\/studyWindow\.js";/);
  assert.equal(script.match(/new Date\(\)/g)?.length, 1);
  assert.match(script, /startDate: fromDateInput\.value,\s+endDate: toDateInput\.value/);
  assert.match(script, /fromDateInput\.disabled = isWorking/);
  assert.match(script, /toDateInput\.disabled = isWorking/);
  assert.match(script, /exportHistory\(\{[\s\S]*studyWindow,/);
});
