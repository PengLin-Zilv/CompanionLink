# Study Date Range Filter Spec

This spec supersedes the original start-date-to-submit-time behavior and the fixed Eastern-Time date window.

## Required Behavior

The extension popup requires:

```text
Participant ID
From date
To date
```

Both date controls use:

```html
<input type="date" required>
```

## Date Semantics

Both dates are calendar dates in the computer's time zone, detected with
`Intl.DateTimeFormat().resolvedOptions().timeZone` when the form is submitted.
Capture it once and keep it with the study window for filtering and CSV conversion.
No time-zone selector is required. "Today" is determined in this same time zone.

The effective export interval is:

```text
from_midnight <= message_timestamp < effective_end
```

where:

```text
selected_end = local midnight immediately after To date
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

The CSV header is:

```csv
Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID
```

Local and Eastern timestamps use `YYYY-MM-DD HH:mm:ss`. UTC uses
`YYYY-MM-DDTHH:mm:ss.sssZ`, preserving milliseconds. Eastern means
`America/New_York`. Local_Timezone records the captured computer zone.
Use each message's date to apply daylight-saving rules, not today's UTC offset.
The export does not infer historical location or track travel.

The selected dates are not added to the CSV. A range with no messages
downloads a header-only CSV and reports:

```text
0 messages exported
```

## Architecture

`extension/studyWindow.js` owns:

- From/To validation
- detected local time zone and calendar-date conversion
- inclusive To-date conversion to the following midnight
- submit-time capping when To date is today
- timestamp inclusion and pagination-stop predicates

`extension/export.js` captures submit time once and passes both dates to the
study-window helper.

`extension/v17Client.js` consumes the `includes(timestamp)` and
`isOlderThanStart(timestamp)` predicates and passes the captured time zone to
`csvWriter.js` for every batch.

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
- manual timezone selection or historical location tracking
- direct upload
- columns beyond the eight-column contract above

## Acceptance Checklist

- Both dates are required.
- Both dates are inclusive calendar dates in the detected computer time zone.
- To date of today is capped at submit time.
- Invalid, reversed, and future ranges are rejected.
- All exported messages fall inside the effective range.
- CSV uses the agreed eight columns; filename, non-time mapping, and row order remain unchanged.
- Empty ranges produce a header-only CSV.
- Changing the computer time zone during export does not change that export's time zone.
- Test both sides of midnight, fractional-offset zones, and 23/25-hour daylight-saving days.
- UTC distinguishes messages with repeated local clock times.
