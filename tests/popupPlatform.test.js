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

test("any other page says what to open and disables the form", () => {
  for (const url of ["https://example.com/", "https://kindroid.ai/v2/chat/group/abc", "https://kindroid.ai/home", "", "--query-fails"]) {
    const popup = openPopup(url);
    assert.equal(popup.keyHidden, true, url);
    assert.equal(popup.platform, "", url);
    assert.equal(popup.tone, "error", url);
    assert.match(popup.status, /Open Replika or a one-to-one Kindroid chat/, url);
    assert.deepEqual(popup.disabled, [true, true, true, true], url);
  }
});
