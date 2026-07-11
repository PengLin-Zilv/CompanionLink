# Replika Exporter MVP Spec

## First Principles Analysis: Replika Participant Export

### 1. Problem Essence

**Core problem:** Online participants need to produce the same CSV the lab already accepts, without DevTools, `.ini` editing, Python, or manual renaming.

**Success criteria:**

- Participant logs into Replika web in their own browser.
- Participant opens the LinkLab extension.
- Participant enters an ID such as `040`.
- Extension downloads `P040.csv`.
- CSV header is exactly `Timestamp,From,Text,Reaction,ID`.
- CSV rows preserve the current `chat_backup.py` semantics.
- Replika auth token, device ID, user ID, chat ID, email, password, and profile data are not written to CSV or sent to LinkLab.

### 2. Assumptions Challenged

| Assumption | Challenge | Verdict |
| --- | --- | --- |
| The extension only needs localStorage access | The current manual workflow copies a v17 init message from DevTools; that value may be in runtime WebSocket traffic, not just storage. | Modify: capture or read the v17 init locally. |
| `PID.csv` is a literal filename | The participant ID is the variable. `040` should produce `P040.csv`. | Modify: normalize participant ID to `P{id}.csv`. |
| Direct upload is part of MVP | Local CSV download already solves the participant-hostile workflow and has a smaller privacy surface. | Discard for v1. |
| The extension can improve CSV shape | The downstream lab pipeline expects the existing contract. | Discard. |

### 3. Ground Truths

- `chat_backup.py` is the behavioral source of truth for v1.
- The lab CSV contract has exactly five columns: `Timestamp,From,Text,Reaction,ID`.
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
  -> Timestamp
  -> convert UTC to America/New_York
  -> format "%Y-%m-%d %H:%M:%S"

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

#### v17 Flow

- Open `wss://ws.replika.ai/v17`.
- Send the captured raw `init` message when the socket opens.
- On server `init`, send `chat_screen`.
- On server `chat_screen`, send `application_started`.
- On server `application_started`, send `app_foreground`.
- On server `app_foreground`, send initial `history` with `limit: 1000`.
- For every `history` response, process messages from last index to first index.
- Request older history with `last_message_id` set to the final processed message ID.
- Stop when the server returns an empty `messages` array.

#### Privacy Boundary

- Do not ask for a Replika password.
- Do not persist Replika auth/session values.
- Do not include auth token, device ID, user ID, chat ID, email, or profile data in CSV.
- Do not upload to LinkLab in v1.

### 5. Architecture

```text
extension/export.html
  -> extension/export.js
  -> extension/sessionBridge.js
  -> extension/v17Client.js
  -> extension/csvWriter.js

extension/contentScript.js
  -> extension/pageBridge.js
  -> Replika page WebSocket traffic / storage
```

- `csvWriter.js` owns CSV conversion, New York timestamp formatting, CSV escaping, and filename normalization.
- `v17Client.js` owns WebSocket sequencing and history pagination.
- `pageBridge.js` runs in the Replika page context and captures the raw v17 init message when available.
- `contentScript.js` keeps the latest init message in memory and responds to extension requests.
- `sessionBridge.js` asks the active Replika tab for the latest init message.
- `export.js` coordinates participant input, export progress, CSV generation, and browser download.

### 6. Verification

- Unit tests verify filename normalization.
- Unit tests verify CSV header, row order, timestamp conversion, sender mapping, reaction fallback, newline escaping, and CSV quoting.
- Unit tests verify v17 event sequencing and `last_message_id` pagination using a fake WebSocket.
- Static tests verify required extension files and manifest permissions.
- Live Replika export is a manual verification step because it requires an authenticated participant browser session.

### 7. Out Of Scope

- Direct upload.
- JSON export.
- Diary, memory, image, voice, or analytics export.
- Account linking.
- Third-party proxy services.
- Persistent Replika auth/session storage.
- Alternate CSV schemas or extra columns.
