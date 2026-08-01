# Study Date Range Filter Spec

This spec supersedes the original start-date-to-submit-time behavior.

The approved design is:

```text
docs/superpowers/specs/2026-07-29-study-date-range-design.md
```

## Required Behavior

The extension popup requires:

```text
Participant ID (PID)
From date
To date
```

Both date controls use:

```html
<input type="date" required>
```

## Date Semantics

Both dates are `America/New_York` calendar dates.

The effective export interval is:

```text
from_midnight <= message_timestamp < effective_end
```

where:

```text
selected_end = New York midnight immediately after To date
effective_end = min(selected_end, submit_time)
```

This means:

- both selected dates are inclusive
- a past To date includes that complete day
- a To date of today includes messages through export time
- a future To date is rejected
- a From date after the To date is rejected

Do not implement the inclusive end as `23:59:59` or `23:59:59.999`.

## Output Contract

The filename remains:

```text
P{participant_id}.csv
```

The CSV header remains:

```csv
Timestamp,From,Text,Reaction,ID
```

The date range does not add columns or metadata. A range with no messages
downloads a header-only CSV and reports:

```text
0 messages exported
```

## Architecture

`extension/studyWindow.js` owns:

- From/To validation
- New York calendar-date conversion
- inclusive To-date conversion to the following midnight
- submit-time capping when To date is today
- timestamp inclusion and pagination-stop predicates

`extension/export.js` captures submit time once and passes both dates to the
study-window helper.

`extension/v17Client.js` remains unchanged. It consumes the existing
`includes(timestamp)` and `isOlderThanStart(timestamp)` predicates.

## Privacy Boundary

The two dates are used only in extension memory.

Do not:

- persist either date
- add either date to the CSV
- upload dates or messages
- include auth token, device ID, user ID, chat ID, email, or profile data

## Out Of Scope

- time-of-day controls
- future To dates
- multiple date ranges
- timezone selection
- direct upload
- extra CSV columns

## Acceptance Checklist

- Both dates are required.
- Both dates are inclusive New York calendar dates.
- To date of today is capped at submit time.
- Invalid, reversed, and future ranges are rejected.
- All exported messages fall inside the effective range.
- CSV schema, filename, mapping, and row order remain unchanged.
- Empty ranges produce a header-only CSV.
