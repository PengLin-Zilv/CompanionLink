# Study Start Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export only Replika messages from a required study start date through the instant the participant submits the popup form.

**Architecture:** A small `studyWindow.js` module owns New York calendar-date boundaries and exact submit-time comparison. The popup creates one window per submission, and `v17Client.js` uses it both to filter messages and to stop requesting older pages.

**Tech Stack:** Plain JavaScript ES modules, Chrome Manifest V3, Node's built-in test runner, browser `Intl.DateTimeFormat`.

## Global Constraints

- Study start date is required and interpreted from `00:00:00 America/New_York`.
- Export interval is `[study_start, submit_time)` with `submit_time` captured once.
- CSV header stays exactly `Timestamp,From,Text,Reaction,ID`.
- Filename stays `P{participant_id}.csv`.
- No new dependencies, persistence, upload, end date, timezone selector, or CSV columns.

---

### Task 1: Study Window Boundary

**Files:**
- Create: `extension/studyWindow.js`
- Create: `tests/studyWindow.test.js`

**Interfaces:**
- Produces: `createStudyWindow({ startDate, submittedAt, timeZone })` returning `{ startMs, endMs, includes(timestamp), isOlderThanStart(timestamp) }`.

- [x] **Step 1: Write the failing tests**

```js
import { createStudyWindow } from "../extension/studyWindow.js";

const window = createStudyWindow({
  startDate: "2026-07-21",
  submittedAt: new Date("2026-07-21T16:00:00.000Z")
});

assert.equal(window.startMs, Date.parse("2026-07-21T04:00:00.000Z"));
assert.equal(window.includes("2026-07-21T03:59:59.999Z"), false);
assert.equal(window.includes("2026-07-21T04:00:00.000Z"), true);
assert.equal(window.includes("2026-07-21T16:00:00.000Z"), false);
assert.throws(() => createStudyWindow({
  startDate: "2026-07-22",
  submittedAt: new Date("2026-07-21T16:00:00.000Z")
}), /future/i);
```

- [x] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `node --test tests/studyWindow.test.js`
Expected: FAIL because `extension/studyWindow.js` does not exist.

- [x] **Step 3: Implement the minimal boundary helper**

```js
export function createStudyWindow({
  startDate,
  submittedAt = new Date(),
  timeZone = "America/New_York"
}) {
  validateDateInput(startDate);
  const endMs = new Date(submittedAt).getTime();
  const startMs = startOfZonedDate(startDate, timeZone);

  if (startMs > endMs) throw new Error("Study start date cannot be in the future.");

  return {
    startMs,
    endMs,
    includes: (timestamp) => {
      const value = parseTimestamp(timestamp);
      return startMs <= value && value < endMs;
    },
    isOlderThanStart: (timestamp) => parseTimestamp(timestamp) < startMs
  };
}
```

- [x] **Step 4: Run `node --test tests/studyWindow.test.js` and confirm all cases pass**

### Task 2: v17 Filtering And Early Pagination Stop

**Files:**
- Modify: `extension/v17Client.js`
- Modify: `tests/v17Client.test.js`

**Interfaces:**
- Consumes: optional `studyWindow` from Task 1.
- Produces: filtered rows in existing newest-to-oldest order.

- [x] **Step 1: Write a failing WebSocket history test**

```js
const studyWindow = createStudyWindow({
  startDate: "2026-07-08",
  submittedAt: new Date("2026-07-08T20:36:41.000Z")
});

const exportPromise = exportHistory({ initMessage, WebSocketCtor: FakeWebSocket, studyWindow });
// Complete the handshake, then emit one history page containing a pre-start,
// in-window, and at-submit message.
assert.deepEqual(rows.map((row) => row.ID), ["inside-window"]);
assert.equal(historyRequests.length, 1);
```

- [x] **Step 2: Run `node --test tests/v17Client.test.js` and confirm filtering assertions fail**

- [x] **Step 3: Filter the current page and stop after crossing the lower boundary**

```js
const includedMessages = studyWindow
  ? messages.filter((message) => studyWindow.includes(message.meta.timestamp))
  : messages;

rows.push(...messagesToRows({
  ...serverEvent,
  payload: { ...serverEvent.payload, messages: includedMessages }
}));
onProgress(rows.length);

if (studyWindow?.isOlderThanStart(messages[0].meta.timestamp)) {
  settled = true;
  socket.close();
  resolve(rows);
  return;
}
```

- [x] **Step 4: Run `node --test tests/v17Client.test.js` and confirm both old and new behavior pass**

### Task 3: Popup Requirement And Submission Wiring

**Files:**
- Modify: `extension/export.html`
- Modify: `extension/export.js`
- Modify: `tests/extensionStatic.test.js`

**Interfaces:**
- Consumes: `createStudyWindow` and `exportHistory({ studyWindow })`.
- Produces: one required date input and a window captured at form submission.

- [x] **Step 1: Add failing static assertions**

```js
assert.match(html, /<label for="study-start-date">Study start date<\/label>/);
assert.match(html, /id="study-start-date"[^>]*type="date"[^>]*required/);
```

- [x] **Step 2: Run `node --test tests/extensionStatic.test.js` and confirm the date-input assertion fails**

- [x] **Step 3: Add the required field and wire it to export**

```html
<label for="study-start-date">Study start date</label>
<input id="study-start-date" name="study-start-date" type="date" required>
```

```js
const submittedAt = new Date();
const studyWindow = createStudyWindow({
  startDate: studyStartDateInput.value,
  submittedAt
});
const rows = await exportHistory({ initMessage, studyWindow, onProgress });
```

- [x] **Step 4: Run `node --test tests/extensionStatic.test.js` and the full `npm.cmd test` suite**

### Task 4: Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/replika-exporter-mvp-spec.md`
- Modify: `replika-online-export-visual-workflow.md`

**Interfaces:**
- Documents the exact implemented participant flow and unchanged output contract.

- [x] **Step 1: Document the required date and `[study_start, submit_time)` behavior**

```text
Replika web
-> LinkLab Replika Exporter
-> enter Participant ID and study start date
-> download P040.csv containing only study-period messages
```

- [x] **Step 2: Run the complete verification set**

Run:

```powershell
npm.cmd test
git diff --check
rg "Study start date|study start date" README.md docs/replika-exporter-mvp-spec.md replika-online-export-visual-workflow.md
git status --short
```

Expected: all tests pass, no whitespace errors, all three user-facing docs describe the date requirement, and status contains only intentional feature files.
