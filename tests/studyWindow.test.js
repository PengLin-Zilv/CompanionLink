import test from "node:test";
import assert from "node:assert/strict";

import { createStudyWindow } from "../extension/studyWindow.js";

test("uses inclusive New York calendar-date boundaries", () => {
  const summerRange = createStudyWindow({
    startDate: "2026-07-01",
    endDate: "2026-07-07",
    submittedAt: new Date("2026-07-08T16:00:00.000Z")
  });
  const winterRange = createStudyWindow({
    startDate: "2026-01-01",
    endDate: "2026-01-07",
    submittedAt: new Date("2026-01-08T16:00:00.000Z")
  });

  assert.equal(summerRange.startMs, Date.parse("2026-07-01T04:00:00.000Z"));
  assert.equal(summerRange.endMs, Date.parse("2026-07-08T04:00:00.000Z"));
  assert.equal(winterRange.startMs, Date.parse("2026-01-01T05:00:00.000Z"));
  assert.equal(winterRange.endMs, Date.parse("2026-01-08T05:00:00.000Z"));
});

test("includes the whole To date and excludes the following midnight", () => {
  const studyWindow = createStudyWindow({
    startDate: "2026-07-21",
    endDate: "2026-07-21",
    submittedAt: new Date("2026-07-22T16:00:00.000Z")
  });

  assert.equal(studyWindow.includes("2026-07-21T03:59:59.999Z"), false);
  assert.equal(studyWindow.includes("2026-07-21T04:00:00.000Z"), true);
  assert.equal(studyWindow.includes("2026-07-22T03:59:59.999Z"), true);
  assert.equal(studyWindow.includes("2026-07-22T04:00:00.000Z"), false);
  assert.equal(studyWindow.isOlderThanStart("2026-07-21T03:59:59.999Z"), true);
  assert.equal(studyWindow.isOlderThanStart("2026-07-21T04:00:00.000Z"), false);
});

test("caps a To date of today at submit time", () => {
  const studyWindow = createStudyWindow({
    startDate: "2026-07-29",
    endDate: "2026-07-29",
    submittedAt: new Date("2026-07-29T16:00:00.000Z")
  });

  assert.equal(studyWindow.endMs, Date.parse("2026-07-29T16:00:00.000Z"));
  assert.equal(studyWindow.includes("2026-07-29T15:59:59.999Z"), true);
  assert.equal(studyWindow.includes("2026-07-29T16:00:00.000Z"), false);
});

test("uses the correct offsets across a daylight-saving transition", () => {
  const studyWindow = createStudyWindow({
    startDate: "2026-03-07",
    endDate: "2026-03-08",
    submittedAt: new Date("2026-03-10T16:00:00.000Z")
  });

  assert.equal(studyWindow.startMs, Date.parse("2026-03-07T05:00:00.000Z"));
  assert.equal(studyWindow.endMs, Date.parse("2026-03-09T04:00:00.000Z"));
});

test("rejects missing, invalid, reversed, or future date ranges", () => {
  const submittedAt = new Date("2026-07-29T16:00:00.000Z");

  assert.throws(
    () => createStudyWindow({ startDate: "", endDate: "2026-07-29", submittedAt }),
    { message: "From date is required." }
  );
  assert.throws(
    () => createStudyWindow({ startDate: "2026-07-29", endDate: "", submittedAt }),
    { message: "To date is required." }
  );
  assert.throws(
    () => createStudyWindow({
      startDate: "2026-02-30",
      endDate: "2026-07-29",
      submittedAt
    }),
    { message: "From date must be a valid date." }
  );
  assert.throws(
    () => createStudyWindow({
      startDate: "2026-07-29",
      endDate: "2026-02-30",
      submittedAt
    }),
    { message: "To date must be a valid date." }
  );
  assert.throws(
    () => createStudyWindow({
      startDate: "2026-07-29",
      endDate: "2026-07-28",
      submittedAt
    }),
    { message: "From date cannot be after To date." }
  );
  assert.throws(
    () => createStudyWindow({
      startDate: "2026-07-29",
      endDate: "2026-07-30",
      submittedAt: new Date("2026-07-30T02:00:00.000Z")
    }),
    { message: "To date cannot be in the future." }
  );
});
