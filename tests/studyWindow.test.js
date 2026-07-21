import test from "node:test";
import assert from "node:assert/strict";

import { createStudyWindow } from "../extension/studyWindow.js";

test("uses New York midnight for the selected study start date", () => {
  const summerWindow = createStudyWindow({
    startDate: "2026-07-21",
    submittedAt: new Date("2026-07-21T16:00:00.000Z")
  });
  const winterWindow = createStudyWindow({
    startDate: "2026-01-21",
    submittedAt: new Date("2026-01-21T16:00:00.000Z")
  });

  assert.equal(summerWindow.startMs, Date.parse("2026-07-21T04:00:00.000Z"));
  assert.equal(winterWindow.startMs, Date.parse("2026-01-21T05:00:00.000Z"));
});

test("includes only timestamps from study start through before submit time", () => {
  const studyWindow = createStudyWindow({
    startDate: "2026-07-21",
    submittedAt: new Date("2026-07-21T16:00:00.000Z")
  });

  assert.equal(studyWindow.includes("2026-07-21T03:59:59.999Z"), false);
  assert.equal(studyWindow.includes("2026-07-21T04:00:00.000Z"), true);
  assert.equal(studyWindow.includes("2026-07-21T15:59:59.999Z"), true);
  assert.equal(studyWindow.includes("2026-07-21T16:00:00.000Z"), false);
  assert.equal(studyWindow.isOlderThanStart("2026-07-21T03:59:59.999Z"), true);
  assert.equal(studyWindow.isOlderThanStart("2026-07-21T04:00:00.000Z"), false);
});

test("rejects invalid or future study start dates", () => {
  const submittedAt = new Date("2026-07-21T16:00:00.000Z");

  assert.throws(
    () => createStudyWindow({ startDate: "", submittedAt }),
    /required/i
  );
  assert.throws(
    () => createStudyWindow({ startDate: "2026-02-30", submittedAt }),
    /valid/i
  );
  assert.throws(
    () => createStudyWindow({ startDate: "2026-07-22", submittedAt }),
    /future/i
  );
});
