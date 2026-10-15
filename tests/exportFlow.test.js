import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const scenario of ["close", "malformed"]) {
  test(`popup ${scenario} failure shows an error, downloads nothing, and enables retry`, () => {
    const child = spawnSync(process.execPath, ["tests/fixtures/popupExport.mjs", scenario], {
      encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
    });
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    const result = JSON.parse(child.stdout);
    assert.equal(result.csv, null);
    assert.equal(result.filename, undefined);
    assert.equal(result.tone, "error");
    assert.match(result.status, /try again/i);
    assert.equal(result.progress, "");
    assert.equal(result.reveals, 0);
    assert.deepEqual(result.disabled, [false, false, false, false]);
  });
}

test("popup repeat-only page finishes with exactly the two original messages", () => {
  const child = spawnSync(process.execPath, ["tests/fixtures/popupExport.mjs", "repeat"], {
    encoding: "utf8", env: { ...process.env, TZ: "America/Los_Angeles" }, timeout: 10000
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const result = JSON.parse(child.stdout);
  assert.equal(result.filename, "P040.csv");
  assert.equal(result.tone, "info");
  assert.equal(result.status, "Downloaded P040.csv");
  assert.equal(result.progress, "2 messages exported");
  assert.equal(result.reveals, 0);
  assert.deepEqual(result.disabled, [false, false, false, false]);
  const rows = result.csv.trimEnd().split("\r\n").slice(1).map((line) => line.split(","));
  assert.deepEqual(rows.map((row) => row.at(-1)), ["late", "midday"]);
  assert.ok(rows.every((row) => row[1] === "America/Los_Angeles"));
});

for (const [timeZone, ids, firstRow] of [
  ["America/Los_Angeles", ["late", "midday", "boundary"],
    "2026-09-07 16:59:00,America/Los_Angeles,2026-09-07T23:59:00.000Z,2026-09-07 19:59:00,Me,Example,None,late"],
  ["Asia/Shanghai", ["midday", "boundary", "early"],
    "2026-09-07 20:00:00,Asia/Shanghai,2026-09-07T12:00:00.000Z,2026-09-07 08:00:00,Me,Example,None,midday"]
]) {
  test(`popup exports local dates and CSV times in ${timeZone}, keeping the zone across batches`, () => {
    const child = spawnSync(process.execPath, ["tests/fixtures/popupExport.mjs"], {
      encoding: "utf8", env: { ...process.env, TZ: timeZone }, timeout: 10000
    });
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    const result = JSON.parse(child.stdout);
    assert.equal(result.filename, "P040.csv");
    assert.equal(result.status, "Downloaded P040.csv");
    assert.equal(result.progress, "3 messages exported");
    assert.equal(result.reveals, 0);
    const lines = result.csv.trimEnd().split("\r\n");
    assert.equal(lines[0], "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID");
    assert.equal(lines[1], firstRow);
    assert.deepEqual(lines.slice(1).map((line) => line.split(",").at(-1)), ids);
    assert.ok(lines.slice(1).every((line) => line.split(",")[1] === timeZone));
  });
}

test("default study window uses the computer timezone to determine today", () => {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { createStudyWindow } from './extension/studyWindow.js';
    const window = createStudyWindow({
      startDate: '2026-09-08', endDate: '2026-09-08',
      submittedAt: '2026-09-08T01:30:00Z'
    });
    console.log(JSON.stringify(window));
  `], { encoding: "utf8", env: { ...process.env, TZ: "Asia/Shanghai" }, timeout: 10000 });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const window = JSON.parse(child.stdout);
  assert.equal(window.startMs, Date.parse("2026-09-07T16:00:00Z"));
  assert.equal(window.endMs, Date.parse("2026-09-08T01:30:00Z"));
  assert.equal(window.timeZone, "Asia/Shanghai");
});
