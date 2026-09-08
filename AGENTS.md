# AGENTS.md

Project guidance for Codex agents working on the LinkLab Replika online export tool.

## First Principle

The job is to help an online participant export a selected local-date chat history to `P{participant_id}.csv`, without DevTools, `.ini` editing, Python, or manual renaming.

Every change must trace directly to that job.

## Source Of Truth

For the Replika exporter MVP, follow this order:

1. The user's latest explicit instruction.
2. This `AGENTS.md`.
3. Current specs: `docs/replika-exporter-mvp-spec.md` and
   `docs/study-start-date-filter-spec.md`.
4. Existing behavior from `chat_backup.py` for retrieval and non-time CSV mapping.

`replika-online-export-visual-workflow.md` records the historical MVP. Its
Eastern-only date window and five-column schema have been superseded.

If these conflict, stop and ask one focused question before implementing.

## Required MVP Behavior

Build a Chrome extension that replaces the current manual flow:

```text
Replika web
-> DevTools
-> copy v17 init message
-> paste into chat_backup.ini
-> run chat_backup.py
-> generate CSV
-> rename CSV to PID.csv
```

with:

```text
Replika web
-> LinkLab Chrome extension
-> download PID.csv
```

The CSV contract is exact:

```csv
Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID
```

The downloaded filename is exact:

```text
P{participant_id}.csv
```

## Explicitly Out Of Scope

Do not add these unless the user explicitly changes the spec:

- JSON export
- direct upload to a lab server
- diary export
- memory export
- image export
- voice export
- analytics
- account linking
- dashboards
- third-party proxy services
- persistent Replika auth/session storage
- alternate CSV schemas
- extra metadata columns beyond the eight-column contract above
- support for apps other than Replika

## CSV Mapping

Preserve the legacy non-time mapping and use the current time columns:

```text
meta.timestamp
  -> Timestamp_UTC: UTC ISO string with milliseconds and Z
  -> Timestamp_Local: captured computer zone, YYYY-MM-DD HH:mm:ss
  -> Timestamp_Eastern: America/New_York, YYYY-MM-DD HH:mm:ss

captured computer time zone
  -> Local_Timezone (for example America/Los_Angeles)

meta.nature == "Robot"
  -> From = "Rep"

otherwise
  -> From = "Me"

content.text
  -> Text
  -> replace newline with literal "\n"

message_reactions[message.id]
  -> Reaction

missing reaction
  -> Reaction = "None"

message.id
  -> ID
```

Rows should preserve the current newest-to-oldest `.no.csv` behavior unless the user explicitly requests a different order.

Capture the computer time zone once at submission. Use it for both From/To
boundaries and every batch's CSV conversion. Apply each message date's
daylight-saving rules. This does not establish the participant's historical
location; do not infer travel from UTC timestamps.

## Implementation Discipline

Before coding, state a short spec-compliance plan:

- Required behavior from the spec
- Files to create or change
- Explicit out-of-scope items
- Verification steps
- Open questions, if any

Do not write code until that plan is clear. If requirements are ambiguous, ask one focused question.

While coding:

- Make the smallest change that satisfies the spec.
- Prefer plain JavaScript, HTML, and CSS for the Chrome extension MVP.
- Avoid build tools unless they are truly necessary.
- Avoid new dependencies unless the benefit is concrete and stated.
- Do not refactor unrelated files.
- Do not improve adjacent code just because it is nearby.
- Do not rename public fields, files, or workflows unless the spec requires it.

## Privacy And Safety Boundary

The extension may use Replika session values locally to fetch the participant's own messages.

The extension must not:

- ask for a Replika password
- write auth tokens to CSV
- write device IDs to CSV
- write Replika user IDs to CSV
- send Replika auth/session values to LinkLab
- persist auth/session values after export

For v1, local CSV download is the data boundary.

## Verification Requirements

Before claiming the work is done, verify:

- The extension downloads a file named `P{participant_id}.csv` (040 -> P040.csv).
- The CSV header is exactly `Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID`.
- No extra CSV columns are present.
- `Robot` maps to `Rep`.
- non-`Robot` messages map to `Me`.
- missing reactions become `None`.
- newlines in message text become literal `\n`.
- Local/Eastern timestamps use `YYYY-MM-DD HH:mm:ss`; UTC preserves milliseconds with a trailing `Z`.
- Date filtering and local timestamps use the same captured computer time zone.
- Tests cover local midnight boundaries, daylight-saving transitions, and popup-to-download behavior with simulated browser/network boundaries.
- no auth token, device ID, user ID, chat ID, or profile data appears in the CSV.

If live Replika testing is not possible, say so and verify with fixtures or mocked v17 payloads.

## Completion Report

When finished, report:

- changed files
- how each file maps to the spec
- verification performed
- anything not tested or blocked

Keep the summary short and concrete.
