import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isReplikaTabUrl } from "../extension/sessionBridge.js";

test("extension manifest exposes only the MVP browser surfaces", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "CompanionLink");
  assert.equal(manifest.action.default_popup, "export.html");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.ok(manifest.host_permissions.includes("https://*.replika.ai/*"));
  assert.ok(manifest.host_permissions.includes("https://*.replika.com/*"));
  assert.ok(manifest.host_permissions.includes("wss://ws.replika.ai/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://*.replika.com/*"));
  assert.equal(manifest.content_scripts[0].js[0], "contentScript.js");
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

test("session bridge accepts live Replika web tab URLs", () => {
  assert.equal(isReplikaTabUrl("https://my.replika.com/chat"), true);
  assert.equal(isReplikaTabUrl("https://replika.com/"), true);
  assert.equal(isReplikaTabUrl("https://ws.replika.ai/v17"), true);
  assert.equal(isReplikaTabUrl("https://example.com/replika.com"), false);
  assert.equal(isReplikaTabUrl("chrome://extensions"), false);
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
