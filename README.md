# LinkLab Replika Exporter

Chrome extension for exporting a participant's Replika web chat into the CSV format already used by the LinkLab workflow.

The goal is to replace this manual process:

```text
Replika web
-> DevTools
-> copy v17 init message
-> paste into chat_backup.ini
-> run chat_backup.py
-> generate CSV
-> rename CSV to P###.csv
```

with this participant-facing process:

```text
Replika web
-> LinkLab Replika Exporter
-> enter Participant ID (PID), for example 040
-> select From and To dates
-> download P040.csv
```

## Current Status

This is an MVP Chrome extension. It has been verified with automated tests and one live Replika export.

The extension exports text chat inside the selected inclusive From/To date range. It does not export images, voice, diary, memory, analytics, or profile data.

## Study Period

Both dates are required and interpreted as `America/New_York` calendar dates. The From date begins at midnight, and the To date includes its entire day. If the To date is today, the export includes messages only through the instant the participant clicks **Export CSV**.

The dates are used only in extension memory. They are not added to the CSV or persisted after export.

## CSV Contract

The downloaded file is named from the entered participant ID:

```text
040  -> P040.csv
P040 -> P040.csv
p040 -> P040.csv
```

The CSV header is exactly:

```csv
Timestamp,From,Text,Reaction,ID
```

The exporter preserves the current `chat_backup.py` behavior:

- timestamps are converted to `America/New_York`
- timestamps use `%Y-%m-%d %H:%M:%S`
- `Robot` maps to `Rep`
- non-`Robot` messages map to `Me`
- missing reactions become `None`
- message newlines become literal `\n`
- rows are newest-to-oldest

## Privacy Boundary

The extension uses Replika session values locally in the browser to fetch the participant's own chat history.

The extension does not:

- ask for a Replika password
- upload directly to LinkLab
- use a third-party proxy
- persist Replika auth/session values
- write auth tokens, device IDs, user IDs, chat IDs, email, or profile data to the CSV

For v1, the only output is a local CSV download.

## Load The Extension

1. Open Chrome.
2. Go to:

```text
chrome://extensions
```

3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder:

```text
linklab-replika-exporter/extension
```

6. Pin **LinkLab Replika Exporter** if you want it visible in the toolbar.

## Export A Chat

1. Open Replika web in Chrome and log in.
2. Refresh the Replika tab once after loading or reloading the extension.
3. Wait for the Replika chat page to finish loading.
4. Click the **LinkLab Replika Exporter** extension icon.
5. Enter the Participant ID (PID), for example:

```text
040
```

6. Select the From and To dates provided by the research team.
7. Click **Export CSV**.
8. Confirm the browser downloaded:

```text
P040.csv
```

## Troubleshooting

### "Open Replika in the active tab before exporting."

Make sure the currently active Chrome tab is a Replika web tab, such as `https://my.replika.com/...`.

### "Replika session was not captured."

Refresh the Replika tab, wait for chat to fully load, then try exporting again. The extension captures the same v17 init/session information that the old workflow copied from DevTools.

### No file downloads

Check whether Chrome blocked downloads or whether another download prompt is waiting. Then reload the extension from `chrome://extensions` and refresh Replika.

## Development

This project uses plain JavaScript and Chrome Manifest V3. There are no runtime npm dependencies.

Run the automated tests:

```powershell
npm.cmd test
```

On shells where `npm` is not blocked by PowerShell execution policy, this also works:

```bash
npm test
```

## Project Layout

```text
extension/
  manifest.json       Chrome extension manifest
  export.html         Popup UI
  export.js           Popup workflow and CSV download
  sessionBridge.js    Active-tab session lookup
  contentScript.js    Replika tab bridge
  pageBridge.js       Page-context v17 init capture
  v17Client.js        Replika v17 WebSocket flow
  studyWindow.js      Inclusive From/To date filtering
  csvWriter.js        CSV mapping and filename normalization

tests/
  csvWriter.test.js
  extensionStatic.test.js
  studyWindow.test.js
  v17Client.test.js

docs/
  replika-exporter-mvp-spec.md
  study-start-date-filter-spec.md
```

## Reference

The behavioral source of truth for v1 is the existing lab script:

```text
C:\Users\linpe\SyracuseUniversity\LinkLab\Replika_Chatlog\replika_backup-main\chat_backup.py
```
