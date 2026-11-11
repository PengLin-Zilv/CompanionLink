import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function openPopup(url) {
  const child = spawnSync(process.execPath, ["tests/fixtures/popupOpen.mjs", url], {
    encoding: "utf8", timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  return JSON.parse(child.stdout);
}

const enabled = [false, false, false, false];

test("a Replika page shows the form as before, without the key field", () => {
  assert.deepEqual(openPopup("https://my.replika.com/chat"), {
    keyHidden: true, platform: "", status: "", tone: "", disabled: enabled
  });
});

test("a one-to-one Kindroid chat shows the key field and marks the form for Kindroid's layout", () => {
  assert.deepEqual(openPopup("https://kindroid.ai/v2/chat/exampleCompanion"), {
    keyHidden: false, platform: "kindroid", status: "", tone: "", disabled: enabled
  });
});

test("a Claude chat shows the form exactly as on Replika", () => {
  assert.deepEqual(openPopup("https://claude.ai/chat/3f2a9c1e-7b4d-4e8f-9a6b-1c2d3e4f5a6b"), {
    keyHidden: true, platform: "", status: "", tone: "", disabled: enabled
  });
});

// popupOpen.mjs has no chrome.scripting, so a request at open would crash it.
test("a ChatGPT chat shows the form exactly as on Replika", () => {
  assert.deepEqual(openPopup("https://chatgpt.com/c/2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091"), {
    keyHidden: true, platform: "", status: "", tone: "", disabled: enabled
  });
});

test("any other page says what to open and disables the form", () => {
  for (const url of [
    "https://example.com/", "https://kindroid.ai/v2/chat/group/abc", "https://kindroid.ai/home",
    "https://claude.ai/new", "https://claude.ai/project/3f2a9c1e-7b4d-4e8f-9a6b-1c2d3e4f5a6b",
    "https://claude.ai/chat/not-a-uuid", "https://chatgpt.com/", "https://chatgpt.com/?temporary-chat=true",
    "https://chatgpt.com/share/2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091", "https://chatgpt.com/g/g-synthetic123-companion",
    "https://chatgpt.com/c/not-a-uuid", "https://chat.openai.com/c/2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091",
    "", "--query-fails"
  ]) {
    const popup = openPopup(url);
    assert.equal(popup.keyHidden, true, url);
    assert.equal(popup.platform, "", url);
    assert.equal(popup.tone, "error", url);
    assert.match(popup.status, /Open Replika, a one-to-one Kindroid chat, a Claude chat or a ChatGPT chat in this tab/, url);
    assert.deepEqual(popup.disabled, [true, true, true, true], url);
  }
});
