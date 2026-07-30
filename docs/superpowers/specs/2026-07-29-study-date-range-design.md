# Study Date Range Design

## Goal

Allow a participant to select a required `From date` and `To date` so the
downloaded CSV contains only Replika messages inside that study period.

This replaces the current range:

```text
Study start date -> export submit time
```

with:

```text
From date -> To date, inclusive
```

The CSV schema, filename, message mapping, row order, and privacy boundary
remain unchanged.

## First Principles Analysis

### Problem Essence

Participants may use existing Replika accounts. The lab needs messages from a
researcher-defined study period, not all account history and not necessarily
everything through the day the participant exports.

Success means:

- both dates are required
- both selected calendar dates are included
- calendar boundaries use `America/New_York`
- future `To date` values are rejected
- the resulting CSV contains no messages outside the effective range
- the existing CSV contract remains unchanged

### Assumptions Challenged

| Assumption | Challenge | Decision |
| --- | --- | --- |
| An inclusive end date should end at `23:59:59` | Message timestamps may contain milliseconds or finer precision. | Represent the end as the next midnight and compare exclusively. |
| Submit time is no longer needed | If `To date` is today, the rest of the day has not happened yet. | Keep submit time as an availability cap. |
| Date-range support requires new WebSocket logic | `v17Client.js` already filters through a generic study-window interface. | Leave WebSocket behavior unchanged. |
| A date library is required | The existing module already converts New York calendar dates to instants. | Extend the existing dependency-free helper. |
| The CSV should record the selected dates | The lab asked to filter the data, not change its schema. | Do not add date columns or metadata. |

### Ground Truths

- Participants select calendar dates, while Replika messages contain timestamp
  instants.
- The existing CSV timestamp display and study-date interpretation use
  `America/New_York`.
- A half-open interval avoids ambiguity at the upper boundary.
- No export can include messages created after the participant submits it.
- `v17Client.js` only needs `includes(timestamp)` and
  `isOlderThanStart(timestamp)`; it does not need to know how dates are chosen.

### Reasoning Chain

```text
Lab defines an inclusive calendar range
-> convert From date to New York midnight
-> convert To date to the following New York midnight
-> cap that upper boundary at submit time
-> filter with start <= timestamp < effective end
-> keep all output contracts unchanged
```

## User Interface

The popup contains three required fields:

```text
Participant ID (PID)
From date
To date
```

Both date fields use native browser date inputs:

```html
<input type="date" required>
```

The hint below `To date` is:

```text
Both dates are included. If To date is today, messages through export time are included.
```

Do not add:

- time-of-day controls
- quick-range presets
- a timezone selector
- an optional all-history mode

## Date Semantics

### Start Boundary

`From date` begins at New York midnight.

For:

```text
From date: 2026-07-01
```

the start boundary is:

```text
2026-07-01 00:00:00 America/New_York
```

### End Boundary

`To date` includes the entire selected calendar date. It is represented as the
following New York midnight, exclusively.

For:

```text
To date: 2026-07-07
```

the selected end boundary is:

```text
2026-07-08 00:00:00 America/New_York
```

Do not calculate the end as `23:59:59` or `23:59:59.999`.

### Submit-Time Cap

Capture submit time exactly once when the participant submits the form:

```text
submitted_at = new Date()
```

The effective end is:

```text
effective_end = min(midnight_after_to_date, submitted_at)
```

Therefore:

- a past `To date` includes that complete day
- a `To date` of today includes messages through submit time
- a future `To date` is rejected

The final interval is:

```text
start_boundary <= message_timestamp < effective_end
```

## Validation

Reject the export when:

- either date is missing
- either date is not a real `YYYY-MM-DD` calendar date
- `From date` is after `To date`
- `To date` is after the current New York calendar date

Use these user-facing errors:

```text
From date is required.
To date is required.
From date must be a valid date.
To date must be a valid date.
From date cannot be after To date.
To date cannot be in the future.
```

`From date` and `To date` may be the same date.

## Architecture

### `extension/studyWindow.js`

Extend the existing interface:

```js
createStudyWindow({
  startDate,
  endDate,
  submittedAt = new Date(),
  timeZone = "America/New_York"
}) -> {
  startMs: number,
  endMs: number,
  includes(timestamp): boolean,
  isOlderThanStart(timestamp): boolean
}
```

Responsibilities:

- validate both calendar dates
- convert `startDate` to New York midnight
- convert the day after `endDate` to New York midnight
- reject a future New York `endDate`
- set `endMs` to the earlier of the selected end boundary and `submittedAt`
- preserve the existing timestamp predicate interface

The helper should reuse the existing calendar-date parser and timezone
conversion logic. Do not introduce a new date abstraction or dependency.

### `extension/export.html`

Replace the single `Study start date` field with required `From date` and
`To date` fields. Keep the popup layout, PID field, button, progress, and status
presentation unchanged.

### `extension/export.js`

Capture `submittedAt` once, read both date inputs, create one study window, and
pass it to `exportHistory`.

Disable both date inputs while an export is running.

### `extension/v17Client.js`

No behavioral change is required. It continues to:

- include messages when `studyWindow.includes(timestamp)` is true
- stop pagination after the oldest fetched message predates the start boundary
- preserve newest-to-oldest output order

### CSV Output

Keep the header exactly:

```csv
Timestamp,From,Text,Reaction,ID
```

Keep filename normalization exactly:

```text
040  -> P040.csv
P040 -> P040.csv
p040 -> P040.csv
```

Do not write either selected date to the CSV.

If the range contains no messages, download a header-only CSV and show:

```text
0 messages exported
```

## Data Flow

```text
Participant submits PID + From date + To date
-> popup captures submittedAt once
-> studyWindow validates and converts calendar boundaries
-> v17Client fetches and filters history
-> csvWriter preserves the existing five-column contract
-> browser downloads P{participant_id}.csv
```

## Testing

### Study Window Unit Tests

Verify:

- `From date` starts at New York midnight in summer and winter
- `To date` includes its whole day and excludes the following midnight
- a range crossing a daylight-saving transition uses the correct boundaries
- `To date` of today is capped at submit time
- same-day ranges are accepted
- `From date` after `To date` is rejected
- future `To date` is rejected using the New York calendar date
- missing and invalid dates use the specified errors

### Popup Static Tests

Verify:

- both date inputs exist
- both date inputs are required
- submit time is captured exactly once
- both values are passed to `createStudyWindow`
- both inputs are disabled during export

### Regression Tests

Verify:

- v17 filtering and early pagination stopping remain green
- CSV header and row mapping remain unchanged
- filename normalization remains unchanged
- an empty range produces a header-only CSV

### Manual Verification

After reloading the unpacked extension:

1. Export a range known to contain messages.
2. Confirm the earliest and latest CSV timestamps fall inside the selected
   inclusive dates.
3. Export a range known to contain no messages and confirm a header-only CSV.
4. Select today as `To date` and confirm messages after the export click are not
   present.

## Privacy Boundary

Both dates are used only in extension memory to filter messages.

Do not:

- persist either date
- add either date to the CSV
- upload dates or messages to LinkLab
- include Replika auth, device, user, chat, email, or profile values in output

## Out Of Scope

- time-of-day selection
- future end dates
- multiple ranges
- timezone selection
- date presets
- direct upload
- date columns or study metadata in CSV
- changes to message mapping or row order

## Acceptance Criteria

- Participant cannot export without both dates.
- Both selected dates are inclusive New York calendar dates.
- Past `To date` values include the complete selected day.
- `To date` of today includes messages only through submit time.
- `From date` after `To date` is rejected.
- Future `To date` is rejected.
- Exported messages all satisfy the effective date range.
- CSV header remains exactly `Timestamp,From,Text,Reaction,ID`.
- Filename remains `P{participant_id}.csv`.
- Empty ranges produce a header-only CSV.
- No date or Replika session metadata is persisted, uploaded, or added to CSV.
