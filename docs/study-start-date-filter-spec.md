# Study Start Date Filter Spec

## First Principles Analysis

### Problem Essence

**Core problem:** Participants may use existing Replika accounts, so an all-history export can include text from before the study. The lab only needs text generated during the experiment.

**Success criteria:**

- Participant must select a study start date before exporting.
- Export includes only text messages from the study start date through the moment the participant clicks export.
- CSV schema stays exactly `Timestamp,From,Text,Reaction,ID`.
- Filename stays `P{participant_id}.csv`, for example `P040.csv`.
- No additional account, study-period, auth, or profile metadata is added to the CSV.

### Assumptions Challenged

| Assumption | Challenge | Verdict |
| --- | --- | --- |
| "Specify a date" means one calendar day | Professor's reason is study-period capture, not single-day export. | Interpret the date as study start date. |
| We need both start and end date | The user clarified the feature is one required study start date through submit time. | Do not add end date in this feature. |
| Date filtering should change CSV columns | Downstream lab contract expects the same CSV shape. | Keep CSV unchanged. |
| Export should still allow all history | Existing accounts create privacy and data-minimization risk. | Require study start date. |

### Ground Truths

- The experiment is online.
- Participants may use existing Replika accounts.
- Pre-study text is not part of the desired dataset.
- The current MVP already exports Replika chat history to the lab CSV format.
- The current CSV timestamp format is New York local time.
- The minimal privacy-preserving change is to filter messages before CSV generation.

### Reasoning Chain

```text
Existing accounts contain pre-study text
-> Lab only needs study-period text
-> Participant must provide the study start boundary
-> Extension captures submit time as the end boundary
-> Export only messages inside [study start, submit time]
-> Keep CSV contract unchanged
```

## Required Behavior

### UI

Add one required field to the extension popup:

```text
Study start date
```

The popup must require both:

- Participant ID (PID)
- Study start date

The study start date should use a browser date input:

```html
<input type="date" required>
```

The UI should not add a study end date in this feature.

### Date Semantics

The selected study start date is interpreted as a New York calendar date.

If the participant selects:

```text
2026-07-21
```

the start boundary is:

```text
2026-07-21 00:00:00 America/New_York
```

The end boundary is captured exactly once when the participant submits the form:

```text
submit_time = new Date()
```

The export includes messages where:

```text
study_start <= message_timestamp < submit_time
```

Future study start dates must be rejected.

### CSV Output

CSV header remains exactly:

```csv
Timestamp,From,Text,Reaction,ID
```

Filename behavior remains:

```text
040  -> P040.csv
P040 -> P040.csv
p040 -> P040.csv
```

If no messages fall within the study window, download a header-only CSV and show `0 messages exported`.

### Privacy Boundary

The selected start date is used only inside the extension to filter messages.

Do not:

- add the study start date to the CSV
- upload the date or messages to LinkLab
- persist the date after export
- include pre-study messages in the CSV
- include auth token, device ID, user ID, chat ID, email, or profile data in the CSV

## Implementation Plan

### Task 1: Add Study Window Helpers

**Files:**

- Create: `extension/studyWindow.js`
- Create: `tests/studyWindow.test.js`

**Interfaces:**

```js
createStudyWindow({
  startDate,
  submittedAt = new Date(),
  timeZone = "America/New_York"
}) -> {
  startMs: number,
  endMs: number,
  includes(timestamp: string): boolean,
  isOlderThanStart(timestamp: string): boolean
}
```

**Verification:**

- `2026-07-21` starts at New York midnight.
- Messages before start are excluded.
- Messages at or after start are included.
- Messages at or after submit time are excluded.
- Future start dates are rejected.

### Task 2: Require Study Start Date In Popup

**Files:**

- Modify: `extension/export.html`
- Modify: `extension/export.js`
- Modify: `tests/extensionStatic.test.js`

**Behavior:**

- Add required `Study start date` field.
- Capture `submittedAt` once on form submit.
- Create the study window before calling `exportHistory`.
- Show a clear validation error if the date is missing or future.

**Verification:**

- Static test confirms date input exists and is required.
- Existing PID copy test stays green.

### Task 3: Filter v17 History By Study Window

**Files:**

- Modify: `extension/v17Client.js`
- Modify: `tests/v17Client.test.js`

**Behavior:**

- `exportHistory` accepts optional `studyWindow`.
- For each `history` batch, include only messages inside the study window.
- Continue paginating while older messages may still be inside the study window.
- Stop pagination after processing a batch whose oldest message is older than the study start.
- Preserve newest-to-oldest output order.

**Verification:**

- Test excludes messages before study start.
- Test excludes messages at or after submit time.
- Test keeps messages inside the study window.
- Test stops paginating once the oldest fetched message is before start.
- Existing v17 event-order test stays green.

### Task 4: Update Docs

**Files:**

- Modify: `docs/replika-exporter-mvp-spec.md`
- Modify: `replika-online-export-visual-workflow.md`

**Behavior:**

- Document the required study start date.
- Document that export range is study start date through submit time.
- Confirm the CSV schema and filename stay unchanged.

## Out Of Scope

- Study end date.
- Multiple study windows.
- Server-side upload.
- Date columns in CSV.
- Manual edit of CSV after download.
- Timezone selector.
- Analytics or participant dashboard.

## Acceptance Checklist

- Participant cannot export without a study start date.
- Export includes only messages from study start date through submit time.
- CSV header remains exactly `Timestamp,From,Text,Reaction,ID`.
- Filename remains `P{participant_id}.csv`.
- Existing CSV mapping behavior remains unchanged.
- Automated tests cover date-window filtering.
- Live test confirms export still downloads successfully from Replika web.
