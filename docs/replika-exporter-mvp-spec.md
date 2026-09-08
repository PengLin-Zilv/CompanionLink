# Replika Exporter MVP Spec

## First Principles Analysis: Replika Participant Export

### 1. Problem Essence

**Core problem:** Online participants need to export their selected local-date chat history into a consistent lab CSV, without DevTools, `.ini` editing, Python, or manual renaming.

**Success criteria:**

- Participant logs into Replika web in their own browser.
- Participant opens the LinkLab extension.
- Participant enters an ID such as `040`.
- Participant selects required From and To dates.
- Extension downloads `P040.csv`.
- CSV includes only messages inside the inclusive date range in the participant computer's time zone.
- CSV header is exactly `Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID`.
- CSV rows preserve the `chat_backup.py` non-time mapping and newest-first order.
- Replika auth token, device ID, user ID, chat ID, email, password, and profile data are not written to CSV or sent to LinkLab.

### 2. Assumptions Challenged

| Assumption | Challenge | Verdict |
| --- | --- | --- |
| The extension only needs localStorage access | The current manual workflow copies a v17 init message from DevTools; that value may be in runtime WebSocket traffic, not just storage. | Modify: capture or read the v17 init locally. |
| `PID.csv` is a literal filename | The participant ID is the variable. `040` should produce `P040.csv`. | Modify: normalize participant ID to `P{id}.csv`. |
| Direct upload is part of MVP | Local CSV download already solves the participant-hostile workflow and has a smaller privacy surface. | Discard for v1. |
| The CSV must keep only Eastern Time | Cross-time-zone studies need local context and precise event matching. | Replace the single timestamp with local time, zone, UTC, and Eastern time; update downstream consumers. |

### 3. Ground Truths

- `chat_backup.py` is the reference for Replika retrieval and non-time CSV mapping.
- The current CSV contract has eight columns: `Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID`.
- `chat_backup.py` uses Replika v17 WebSocket at `wss://ws.replika.ai/v17`.
- `chat_backup.py` sends `init`, `chat_screen`, `application_started`, `app_foreground`, then paged `history` requests.
- The current output order is newest-to-oldest.
- Participants cannot reasonably be asked to use DevTools or Python.
- Local CSV export is the v1 privacy boundary.

### 4. Required Behaviors

#### Filename

- Input `040` produces `P040.csv`.
- Input `P040` or `p040` produces `P040.csv`.
- Empty participant IDs are rejected.
- Participant IDs may contain letters, numbers, `_`, and `-` after trimming.

#### CSV Mapping

```text
meta.timestamp
  -> Timestamp_UTC: normalized UTC ISO string with milliseconds and Z
  -> Timestamp_Local: captured computer zone, YYYY-MM-DD HH:mm:ss
  -> Timestamp_Eastern: America/New_York, YYYY-MM-DD HH:mm:ss

captured computer time zone
  -> Local_Timezone

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

#### Study Window

- From and To dates are required.
- Interpret both as calendar dates in the computer time zone detected at submission.
- Keep this same time zone for all batches and CSV local timestamps.
- Begin at midnight on the From date.
- Represent the inclusive To date with an exclusive boundary at the following midnight.
- Capture submit time exactly once when the participant submits the popup form.
- Cap the end boundary at submit time when the To date is today.
- Include messages where `from_boundary <= message_timestamp < effective_end`.
- Reject a From date after the To date and reject a future To date.
- Do not add either date or submit time to the CSV.
- Download a header-only CSV when no messages fall inside the window.

#### v17 Flow

- Open `wss://ws.replika.ai/v17`.
- Send the captured raw `init` message when the socket opens.
- On server `init`, send `chat_screen`.
- On server `chat_screen`, send `application_started`.
- On server `application_started`, send `app_foreground`.
- On server `app_foreground`, send initial `history` with `limit: 1000`.
- For every `history` response, keep only messages inside the study window, then process them from last index to first index.
- Request older history with `last_message_id` set to the final processed message ID.
- Stop when the server returns an empty `messages` array or the oldest message in a processed batch predates the From boundary.

#### Privacy Boundary

- Do not ask for a Replika password.
- Do not persist Replika auth/session values.
- Do not include auth token, device ID, user ID, chat ID, email, or profile data in CSV.
- Do not upload to LinkLab in v1.

### 5. Architecture

```text
extension/export.html
  -> extension/export.js
  -> extension/studyWindow.js
  -> extension/sessionBridge.js
  -> extension/v17Client.js
  -> extension/csvWriter.js

extension/contentScript.js
  -> extension/pageBridge.js
  -> Replika page WebSocket traffic / storage
```

- `csvWriter.js` owns CSV conversion, local/UTC/Eastern timestamp formatting, CSV escaping, and filename normalization.
- `studyWindow.js` captures the computer time zone and owns local date boundaries and exact submit-time comparison.
- `v17Client.js` owns WebSocket sequencing and history pagination.
- `pageBridge.js` runs in the Replika page context and captures the raw v17 init message when available.
- `contentScript.js` keeps the latest init message in memory and responds to extension requests.
- `sessionBridge.js` asks the active Replika tab for the latest init message.
- `export.js` coordinates participant input, export progress, CSV generation, and browser download.

### 6. Verification

- Unit tests verify filename normalization.
- Unit tests verify CSV header, row order, timestamp conversion, sender mapping, reaction fallback, newline escaping, and CSV quoting.
- Unit tests verify v17 event sequencing and `last_message_id` pagination using a fake WebSocket.
- Unit tests verify date boundaries across time zones and daylight-saving transitions, future-date rejection, message filtering, and pagination stopping.
- Popup integration tests use simulated browser/network boundaries to verify local-date filtering and downloaded CSV contents across batches.
- Static tests verify required extension files and manifest permissions.
- Live Replika export is a manual verification step because it requires an authenticated participant browser session.

### 7. Out Of Scope

- Direct upload.
- JSON export.
- Diary, memory, image, voice, or analytics export.
- Account linking.
- Third-party proxy services.
- Persistent Replika auth/session storage.
- Alternate CSV schemas or columns beyond the eight-column contract.
- Historical location or travel tracking; local conversion uses the computer zone detected at export.
- Multiple study windows or a timezone selector.
