# CompanionLink

CompanionLink is a LinkLab HCI research tool at Syracuse University for exporting participant-authorized chat history from supported AI companion web apps into a consistent CSV format. Replika is the only app supported today; each newly supported app is named in that version's update notes.

The current release candidate supports Replika. It replaces a manual workflow involving browser developer tools, configuration files, Python, and file renaming with a participant-facing Chrome extension.

## Current Support

| Platform | Status | Exported data |
| --- | --- | --- |
| Replika Web | Release candidate | Text messages and reactions |

Images, voice messages, diary entries, memories, analytics, and profile data are not exported.

Additional AI companion platforms will be evaluated and implemented as platform-specific connectors.

## Participant Workflow

```text
Open my.replika.com and sign in
-> Open CompanionLink
-> Enter the assigned Participant ID
-> Select the From date and To date
-> Click Export Chat Log
-> Download P<Participant ID>.csv
```

The extension does not require the participant to open developer tools, install Python, edit configuration files, or rename the downloaded file.

## Date Range

Both dates are required and included in the export. The extension automatically uses the computer's time zone when **Export Chat Log** is clicked. No manual time-zone selection is needed.

- The From date begins at its first local instant, normally midnight (or later if daylight saving time skips midnight).
- A past To date includes the complete day.
- If the To date is today, messages are included through the time the participant clicks **Export Chat Log**.
- Future To dates and reversed date ranges are rejected.

The selected dates are used only during the export and are not added to the CSV. The same detected time zone is used for date filtering and local timestamps throughout the export.

## Output Format

The Participant ID determines the filename:

```text
040  -> P040.csv
P040 -> P040.csv
p040 -> P040.csv
```

The CSV header is:

```csv
Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID
```

| Column | Meaning |
| --- | --- |
| `Timestamp_Local` | Message time in the computer's detected time zone, `YYYY-MM-DD HH:mm:ss` |
| `Local_Timezone` | Detected time-zone name, such as `America/Los_Angeles` |
| `Timestamp_UTC` | Message instant in UTC, `YYYY-MM-DDTHH:mm:ss.sssZ` |
| `Timestamp_Eastern` | Message time in `America/New_York`, `YYYY-MM-DD HH:mm:ss` |

UTC is the reference for matching messages to study prompts and calculating elapsed time. Local and Eastern timestamps apply the time-zone rules at each message's date, including daylight saving time. Repeated local clock times remain distinguishable by UTC.

The detected time zone reflects the computer setting at export, not the participant's historical location. Travel or changed settings cannot be reconstructed from message timestamps alone.

The remaining Replika mapping preserves the existing backup behavior:

- Replika messages use `Rep` and participant messages use `Me`;
- missing reactions use `None`;
- rows are ordered newest to oldest.

Line breaks inside a message stay real line breaks, in a quoted cell, as standard CSV requires. Excel, pandas and R read such a message as one cell; tools that read the file line by line see one message across several lines. Version 0.1.0 and the legacy backup script wrote them as the two characters `\n`.

An export with no messages in the selected range produces a header-only CSV.

This eight-column format replaces the previous five-column CSV. Analysis scripts must use the new headers: the former Eastern `Timestamp` is now `Timestamp_Eastern`. The legacy Python backup script still produces the old format.

## Export Failures

The exporter stops with an error if the connection closes unexpectedly, a
connection or export-response wait reaches 30 seconds, or history responses are
malformed. Repeated message IDs are skipped; an empty page or a page containing
no new IDs ends the export. The timeout applies
to each wait, not the total export duration. Unrelated server events do not
extend it. Non-JSON frames are ignored without resetting the timeout.

Failed exports do not download a partial CSV. The form becomes available again
so the user can retry from the beginning; automatic retry and resume are not
implemented. Keep the popup open until the export completes.

## Privacy Boundary

The extension uses the participant's active Replika web session locally in Chrome to request their chat history.

The extension does not:

- ask for or store a Replika password;
- persist Replika authentication or session values;
- write authentication tokens, device IDs, account IDs, chat IDs, email addresses, or profile data to the CSV;
- transmit the exported chat log to LinkLab or another server.

The only output is a CSV downloaded to the participant's computer.

### Browser Permissions

Automatic session capture and access to the page bridge are limited to
`https://my.replika.com/*`, the supported Replika chat site. The extension rejects
other sites before injecting scripts or requesting a session.

- `activeTab` permits reading the active tab's URL when the extension is opened.
- `scripting`, together with that temporary access, lets the popup ensure its
  content script is installed on the supported chat tab.

No explicit `host_permissions` are requested. This does not mean zero site
access: the manifest still declares a content script on the chat site to capture
the session at page load. Export connects to `wss://ws.replika.ai/v17` only after
submission; the WebSocket endpoint is not a supported browser tab.

## Release Status

Version `0.1.0` is released and unlisted in Chrome Store.

For local development and testing:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `extension` folder.
5. Refresh any open my.replika.com tab before testing.

This unpacked installation flow is for development, not the planned participant workflow.

## Versioning

`extension/manifest.json` holds the version Chrome and the Chrome Web Store read; `package.json` mirrors it. Change both together — a test asserts they match.

Chrome accepts one to four dot-separated integers between 0 and 65535, without leading zeros. Semantic-versioning pre-release suffixes such as `0.2.0-rc1` are invalid in a manifest; use the optional `version_name` field for a display label instead.

The Web Store rejects an upload whose version is not higher than the published one, and a version cannot be reused or rolled back. Every re-upload needs a new version, including a one-line fix.

While the major version is `0`, the CSV schema is not frozen, and a breaking change raises the minor version rather than the major version.

| Version | Meaning |
| --- | --- |
| `0.1.0` | First unlisted Chrome Web Store upload |
| `0.1.x` | Fixes after an upload, however small |
| `0.2.0` | Kindroid connector, keeping the eight-column CSV; message line breaks stay real line breaks |
| `0.3.0` | The next platform after Kindroid (ChatGPT, Gemini or Claude), once its feasibility check passes |
| later `0.x.0` | Each further platform, feature or CSV column change |
| `1.0.0` | CSV schema frozen for a running study |

Tag every uploaded build so the published package maps to a commit:

```powershell
git tag -a v0.1.0 -m "First Chrome Web Store upload"
git push --tags
```

## Documentation

Replika:

- [Participant Instructions](docs/replika/participant-guide.md)
- [Researcher Guide](docs/replika/researcher-guide.md)
- [Visual Workflow and Automation](docs/replika/replika-visual-workflow.md)

The user guides are drafts for the planned Chrome Web Store release. For current local testing, follow the unpacked installation steps above.

## Development

The extension uses plain JavaScript, HTML, CSS, and Chrome Manifest V3. It has no runtime package dependencies.

Run the automated test suite:

```powershell
npm.cmd test
```

The tests cover:

- Participant ID filename normalization;
- CSV mapping and escaping;
- local date boundaries, fractional UTC offsets, and daylight-saving changes;
- UTC, local, and Eastern timestamp conversion;
- Replika v17 event sequencing and history pagination;
- study-window filtering;
- extension files, permissions, and participant-facing copy;
- popup submission through CSV download with simulated browser/network boundaries in multiple time zones.

A complete release check also requires a manual export from an authenticated Replika web account.

## Project Structure

```text
extension/     Chrome extension source
tests/         Automated tests
docs/replika/  Replika guides and visual workflow
```
