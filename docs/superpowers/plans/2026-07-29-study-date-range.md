# Study Date Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single study start date with required inclusive `From date` and `To date` controls.

**Architecture:** Extend `studyWindow.js` to convert the inclusive end date into the following New York midnight and cap it at submit time. Keep the existing predicate interface so `v17Client.js` requires no changes.

**Tech Stack:** Plain JavaScript ES modules, Chrome Manifest V3, `Intl.DateTimeFormat`, Node's built-in test runner.

## Global Constraints

- Both dates are required and interpreted in `America/New_York`.
- The effective interval is `[from midnight, min(midnight after to date, submit time))`.
- `To date` cannot be after the current New York calendar date.
- CSV header remains exactly `Timestamp,From,Text,Reaction,ID`.
- Filename remains `P{participant_id}.csv`.
- Do not add dependencies, time controls, persistence, uploads, or CSV columns.
- Do not modify `extension/v17Client.js`.

---

### Task 1: Inclusive Study Date Window

**Files:**
- Modify: `tests/studyWindow.test.js`
- Modify: `extension/studyWindow.js`

**Interfaces:**
- Consumes: `{ startDate, endDate, submittedAt, timeZone }`.
- Produces: `{ startMs, endMs, includes(timestamp), isOlderThanStart(timestamp) }`.

- [x] **Step 1: Replace the old submit-only tests with failing range tests**

Add tests that assert:

```js
const range = createStudyWindow({
  startDate: "2026-07-01",
  endDate: "2026-07-07",
  submittedAt: new Date("2026-07-08T16:00:00.000Z")
});

assert.equal(range.startMs, Date.parse("2026-07-01T04:00:00.000Z"));
assert.equal(range.endMs, Date.parse("2026-07-08T04:00:00.000Z"));
assert.equal(range.includes("2026-07-08T03:59:59.999Z"), true);
assert.equal(range.includes("2026-07-08T04:00:00.000Z"), false);
```

Also assert:

```js
const todayRange = createStudyWindow({
  startDate: "2026-07-29",
  endDate: "2026-07-29",
  submittedAt: new Date("2026-07-29T16:00:00.000Z")
});

assert.equal(todayRange.endMs, Date.parse("2026-07-29T16:00:00.000Z"));
assert.throws(
  () => createStudyWindow({
    startDate: "2026-07-30",
    endDate: "2026-07-29",
    submittedAt: new Date("2026-07-29T16:00:00.000Z")
  }),
  /From date cannot be after To date/
);
assert.throws(
  () => createStudyWindow({
    startDate: "2026-07-29",
    endDate: "2026-07-30",
    submittedAt: new Date("2026-07-29T16:00:00.000Z")
  }),
  /To date cannot be in the future/
);
```

- [x] **Step 2: Run the focused test**

Run:

```powershell
node --test tests/studyWindow.test.js
```

Expected: FAIL because the existing helper ignores `endDate`.

- [x] **Step 3: Implement the minimal range boundary**

Change the public signature to:

```js
createStudyWindow({
  startDate,
  endDate,
  submittedAt = new Date(),
  timeZone = "America/New_York"
})
```

Parse each date with a field-specific label, compare calendar strings, compute
the following calendar day for `endDate`, and use:

```js
const selectedEndMs = startOfZonedDate(nextCalendarDate(endDate), timeZone);
const endMs = Math.min(selectedEndMs, submittedAtMs);
```

Derive the current New York date from `submittedAt` and reject `endDate` when
it compares later.

- [x] **Step 4: Run the focused and full tests**

```powershell
node --test tests/studyWindow.test.js
npm.cmd test
```

Expected: all study-window and existing regression tests pass.

### Task 2: Required From/To Popup Fields

**Files:**
- Modify: `tests/extensionStatic.test.js`
- Modify: `extension/export.html`
- Modify: `extension/export.js`

**Interfaces:**
- Consumes: required `#from-date` and `#to-date` values.
- Produces: one `createStudyWindow({ startDate, endDate, submittedAt })` call.

- [x] **Step 1: Write failing popup assertions**

Assert:

```js
assert.match(html, /<label for="from-date">From date<\/label>/);
assert.match(html, /<input id="from-date"[^>]*type="date"[^>]*required>/);
assert.match(html, /<label for="to-date">To date<\/label>/);
assert.match(html, /<input id="to-date"[^>]*type="date"[^>]*required>/);
assert.match(script, /startDate: fromDateInput\.value/);
assert.match(script, /endDate: toDateInput\.value/);
```

Remove assertions for `#study-start-date`.

- [x] **Step 2: Run the focused test**

```powershell
node --test tests/extensionStatic.test.js
```

Expected: FAIL because the popup still has one study-start field.

- [x] **Step 3: Implement the two-field popup**

Use:

```html
<label for="from-date">From date</label>
<input id="from-date" name="from-date" type="date" required>
<label for="to-date">To date</label>
<input id="to-date" name="to-date" type="date" required>
<p class="hint">Both dates are included. If To date is today, messages through export time are included.</p>
```

In `export.js`, query both inputs, pass both values to `createStudyWindow`, and
disable both while exporting.

- [x] **Step 4: Run the focused and full tests**

```powershell
node --test tests/extensionStatic.test.js
npm.cmd test
```

Expected: all popup and regression tests pass.

### Task 3: Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/replika-exporter-mvp-spec.md`
- Modify: `docs/study-start-date-filter-spec.md`
- Modify: `replika-online-export-visual-workflow.md`

**Interfaces:**
- Documents the implemented inclusive From/To range and unchanged output contract.

- [x] **Step 1: Update user and architecture documentation**

Document:

```text
From date -> To date, inclusive
effective end = min(midnight after To date, submit time)
```

Remove statements that the only end boundary is submit time or that an end
date is out of scope.

- [x] **Step 2: Run complete verification**

```powershell
npm.cmd test
node --check extension/studyWindow.js
node --check extension/export.js
git diff --check
git status --short
```

Expected: all tests pass, syntax is valid, whitespace is clean, and only the
date-range feature files are modified.
