import test from "node:test";
import assert from "node:assert/strict";

import { createStudyWindow } from "../extension/studyWindow.js";

test("uses inclusive New York calendar-date boundaries", () => {
  const summerRange = createStudyWindow({
    timeZone: "America/New_York",
    startDate: "2026-07-01",
    endDate: "2026-07-07",
    submittedAt: new Date("2026-07-08T16:00:00.000Z")
  });
  const winterRange = createStudyWindow({
    timeZone: "America/New_York",
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
    timeZone: "America/New_York",
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
    timeZone: "America/New_York",
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
    timeZone: "America/New_York",
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
      timeZone: "America/New_York",
      submittedAt: new Date("2026-07-30T02:00:00.000Z")
    }),
    { message: "To date cannot be in the future." }
  );
});

test("keeps the chosen timezone with the window for CSV conversion", () => {
  const window = createStudyWindow({
    startDate: "2026-09-07",
    endDate: "2026-09-07",
    timeZone: "America/Los_Angeles",
    submittedAt: "2026-09-09T00:00:00Z"
  });
  assert.equal(window.timeZone, "America/Los_Angeles");
});

test("uses local midnight boundaries for western, eastern, and fractional-offset zones", () => {
  const cases = [
    ["America/Los_Angeles", "2026-09-07T07:00:00Z", "2026-09-08T07:00:00Z"],
    ["Asia/Shanghai", "2026-09-06T16:00:00Z", "2026-09-07T16:00:00Z"],
    ["Asia/Kathmandu", "2026-09-06T18:15:00Z", "2026-09-07T18:15:00Z"]
  ];
  for (const [timeZone, start, end] of cases) {
    const window = createStudyWindow({
      startDate: "2026-09-07", endDate: "2026-09-07", timeZone,
      submittedAt: "2026-09-09T00:00:00Z"
    });
    assert.equal(window.startMs, Date.parse(start));
    assert.equal(window.endMs, Date.parse(end));
    assert.equal(window.includes(Date.parse(start) - 1), false);
    assert.equal(window.includes(start), true);
    assert.equal(window.includes(Date.parse(end) - 1), true);
    assert.equal(window.includes(end), false);
  }
});

test("includes 23-hour and 25-hour local days across daylight-saving changes", () => {
  for (const [date, start, end] of [
    ["2026-03-08", "2026-03-08T08:00:00Z", "2026-03-09T07:00:00Z"],
    ["2026-11-01", "2026-11-01T07:00:00Z", "2026-11-02T08:00:00Z"]
  ]) {
    const window = createStudyWindow({
      startDate: date, endDate: date, timeZone: "America/Los_Angeles",
      submittedAt: "2026-12-01T00:00:00Z"
    });
    assert.equal(window.startMs, Date.parse(start));
    assert.equal(window.endMs, Date.parse(end));
  }
});

test("determines today and future dates in the selected timezone", () => {
  const submittedAt = "2026-09-08T01:30:00Z";
  assert.throws(() => createStudyWindow({
    startDate: "2026-09-08", endDate: "2026-09-08", submittedAt,
    timeZone: "America/Los_Angeles"
  }), /future/);
  const window = createStudyWindow({
    startDate: "2026-09-08", endDate: "2026-09-08", submittedAt,
    timeZone: "Asia/Shanghai"
  });
  assert.equal(window.startMs, Date.parse("2026-09-07T16:00:00Z"));
  assert.equal(window.endMs, Date.parse(submittedAt));
});

// Regression: midnight is skipped on these dates (23:59:59 -> 01:00:00).
// The old three-adjustment conversion returned 23:00 on the previous day.
for (const [timeZone, previousDate, transitionDate, previousStart, boundary, nextStart] of [
  ["Africa/Cairo", "2026-04-23", "2026-04-24",
    "2026-04-22T22:00:00Z", "2026-04-23T22:00:00Z", "2026-04-24T21:00:00Z"],
  ["Asia/Beirut", "2026-03-28", "2026-03-29",
    "2026-03-27T22:00:00Z", "2026-03-28T22:00:00Z", "2026-03-29T21:00:00Z"]
]) {
  test(`${timeZone}: From date with skipped midnight excludes the previous evening`, () => {
    const window = createStudyWindow({
      startDate: transitionDate,
      endDate: transitionDate,
      timeZone,
      submittedAt: "2027-01-01T00:00:00Z"
    });
    const boundaryMs = Date.parse(boundary);

    assert.equal(window.includes(boundaryMs - 30 * 60 * 1000), false);
    assert.equal(window.startMs, boundaryMs);
    assert.equal(window.includes(boundaryMs - 1), false);
    assert.equal(window.isOlderThanStart(boundaryMs - 1), true);
    assert.equal(window.includes(boundaryMs), true);
    assert.equal(window.isOlderThanStart(boundaryMs), false);
    assert.equal(window.endMs, Date.parse(nextStart));
    assert.equal(window.includes(Date.parse(nextStart) - 1), true);
    assert.equal(window.includes(nextStart), false);
  });

  test(`${timeZone}: To date before skipped midnight keeps its final hour`, () => {
    const window = createStudyWindow({
      startDate: previousDate,
      endDate: previousDate,
      timeZone,
      submittedAt: "2027-01-01T00:00:00Z"
    });
    const boundaryMs = Date.parse(boundary);

    assert.equal(window.includes(boundaryMs - 30 * 60 * 1000), true);
    assert.equal(window.startMs, Date.parse(previousStart));
    assert.equal(window.endMs, boundaryMs);
    assert.equal(window.includes(boundaryMs - 1), true);
    assert.equal(window.includes(boundaryMs), false);
  });
}
