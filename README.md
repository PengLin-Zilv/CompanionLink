# CompanionLink

CompanionLink is a LinkLab HCI research tool at Syracuse University for exporting participant-authorized chat history from supported AI companion web apps into a consistent CSV format. It supports Replika, Kindroid and Claude; each newly supported app is named in that version's update notes.

It replaces a manual workflow involving browser developer tools, configuration files, Python, and file renaming with a participant-facing Chrome extension.

## Current Support

| Platform | Status | Exported data |
| --- | --- | --- |
| Replika Web | Released (0.1.0) | Text messages and reactions |
| Kindroid Web | Released (0.2.0) | Text messages of one-to-one chats; Kindroid's API returns no reactions |
| Claude (claude.ai) | Release candidate (0.3.0) | Text of the chat open in the tab, the versions shown on screen; thumbs up/down ratings are not exported |

Images, voice messages, diary entries, memories, analytics, and profile data are not exported. An image-only message keeps its row with empty Text. For Claude, attachments, artifacts, web searches and other tool use, citation links and Claude's thinking are not exported.

Additional AI companion platforms will be evaluated and implemented as platform-specific connectors.

## Participant Workflow

```text
Sign in, then open my.replika.com, a one-to-one Kindroid chat or a Claude chat
-> Open CompanionLink
-> Enter the assigned Participant ID
-> Select the From date and To date
-> Kindroid only: paste the participant's own Kindroid API key
-> Click Export Chat Log
-> Download P<Participant ID>.csv
-> Claude only: repeat for each chat used during the dates
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

The file is UTF-8 with a byte order mark, so Excel opened by double-click shows emoji and non-English text correctly. In base R, read it with `fileEncoding = "UTF-8-BOM"`; with Python's `csv` module, open it with `open(path, encoding="utf-8-sig", newline="")`. Without `newline=""`, Python changes line breaks inside messages (`\r\n` and a lone `\r` become `\n`). Version 0.1.0 wrote no byte order mark.

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

Kindroid uses the same columns and order: participant messages use `Me` and the Kin's use `Kin`; Reaction is `N/A`, because Kindroid's API returns no reactions (`None` would claim none was given). Rows whose Text starts with `<<ERROR>>` are Kindroid server-error replies stored in the chat history (observed, not documented), not the Kin's words.

Claude also uses the same columns and order: participant messages use `Me` and Claude's use `Claude`; Reaction is `N/A`; ID is the message's ID in Claude. One file holds one chat, the chat open in the tab, and only the versions shown on screen: older versions left by edits and regenerated replies are not exported. Text is the message's text blocks as written: adjacent blocks (a cited sentence split across blocks) join directly, and text resuming after any other block, such as a tool call, starts a new paragraph. A reply's time is when Claude finished it.

Line breaks inside a message stay real line breaks, in a quoted cell, as standard CSV requires. Excel, pandas and R read such a message as one cell; tools that read the file line by line see one message across several lines. Version 0.1.0 and the legacy backup script wrote them as the two characters `\n`.

An export with no messages in the selected range produces a header-only CSV.

This eight-column format replaces the previous five-column CSV. Analysis scripts must use the new headers: the former Eastern `Timestamp` is now `Timestamp_Eastern`. The legacy Python backup script still produces the old format.

## Export Failures

The Replika exporter stops with an error if the connection closes unexpectedly, a
connection or export-response wait reaches 30 seconds, or history responses are
malformed. Repeated message IDs are skipped; an empty page or a page containing
no new IDs ends the export. The timeout applies
to each wait, not the total export duration. Unrelated server events do not
extend it. Non-JSON frames are ignored without resetting the timeout.

Failed exports do not download a partial CSV. The form becomes available again
so the user can retry from the beginning; automatic retry and resume are not
implemented. Keep the popup open until the export completes.

The Kindroid exporter stops with an error on an HTTP error, a network failure, a
request that takes over 60 seconds, a chat with no messages, a malformed or
out-of-order page, or a page with no new messages. Kindroid allows 10 requests per
30 seconds and 600 per day per account, and sends no retry hint, so before each
request the extension waits until the request nine back ended over 31 seconds ago;
exports of more than about 800 messages in the selected dates pause about 30 seconds
after every 9 requests. An
HTTP 429 shows "Kindroid is limiting requests..." and makes the next attempt in the
same popup wait out the window. Responses are fetched with `cache: "no-store"`, so
Chrome does not cache chat text.

The Claude exporter reads claude.ai's own web API, which is undocumented. It asks
for the account's organizations, then for the chat in each organization in turn,
treating a 4xx other than 401 and 429 as the chat not being in that organization.
It stops with an error on a 401 (signed out; also a 403 on the organization list),
a 429, a 5xx, a network failure, a request that takes over 60 seconds, a response
that is not JSON or not in the expected shape, a chat no organization has, a broken
or looping branch, or a message without a time zone.

It also stops when a message hangs below the visible branch's last message, because
exporting would drop the participant's newest message. This was seen live while
Claude was still replying; it is expected, not yet tested, after a failed or
interrupted reply. A reply ended with Claude's Stop button is exported as far as it
got. The time of every message on the visible branch is checked; ID, sender and
content are checked only for messages in the selected dates. Responses are fetched
with `cache: "no-store"`.

## Privacy Boundary

The extension uses the participant's active Replika web session, the Kindroid API key the participant pastes, or the Claude sign-in already in their browser, locally in Chrome to request their chat history. For Claude, requests run inside the participant's claude.ai tab, so the browser attaches the sign-in; the extension never reads it.

The extension does not:

- ask for or store a Replika password;
- persist Replika authentication or session values;
- store the Kindroid API key; it is cleared from the form when each export ends;
- write authentication tokens, device IDs, account IDs, chat IDs, email addresses, or profile data to the CSV;
- transmit the exported chat log to LinkLab or another server.

The only output is a CSV downloaded to the participant's computer.

### Browser Permissions

Automatic session capture and access to the page bridge are limited to
`https://my.replika.com/*`, the supported Replika chat site. The Replika export
rejects other sites before injecting its content script or requesting a session.

- `activeTab` permits reading the active tab's URL when the extension is opened.
- `scripting`, together with that temporary access, lets the popup ensure its
  content script is installed on the supported chat tab.

No explicit `host_permissions` are requested. This does not mean zero site
access: the manifest still declares a content script on the chat site to capture
the session at page load. Export connects to `wss://ws.replika.ai/v17` only after
submission; the WebSocket endpoint is not a supported browser tab.

Kindroid adds no permission. `activeTab` exposes the chat's address, which contains
the chat ID, and Kindroid's API (`https://api.kindroid.ai/v1/get-chat-messages`)
accepts requests from the extension page without host permissions. No script runs
on Kindroid's pages.

Claude adds no permission either. On a Claude chat, the temporary access that
`activeTab` grants when the extension is opened lets `scripting` run the request
function in that tab, in the extension's isolated world, only after **Export Chat
Log** is clicked. No script runs on claude.ai at page load.

## Release Status

CompanionLink is published, unlisted, on the Chrome Web Store. Replika support shipped in `0.1.0` and Kindroid in `0.2.0`; `0.2.1` only rewords the Kindroid privacy note. Version `0.3.0` (Claude) is in preparation.

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
| `0.2.0` | Kindroid connector, keeping the eight-column CSV; message line breaks stay real line breaks; UTF-8 with a byte order mark |
| `0.3.0` | Claude connector: the chat open in the tab, same eight-column CSV |
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

Kindroid:

- [Participant Instructions](docs/kindroid/participant-guide.md)
- [Researcher Guide](docs/kindroid/researcher-guide.md)

Claude:

- [Participant Instructions](docs/claude/participant-guide.md)
- [Researcher Guide](docs/claude/researcher-guide.md)

The Replika and Kindroid guides describe the released versions; the Claude guides are drafts for version 0.3.0. For local testing, follow the unpacked installation steps above.

## Development

The extension uses plain JavaScript, HTML, CSS, and Chrome Manifest V3. It has no runtime package dependencies.

Requires Node.js 22.6 or newer.

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
- Kindroid paging, validation, error messages, request pacing and cache mode;
- Claude chat-page matching, organization lookup, the visible branch, validation, text joining, error messages and the in-tab request;
- study-window filtering;
- extension files, permissions, and participant-facing copy;
- platform detection when the popup opens;
- popup submission through CSV download with simulated browser/network boundaries in multiple time zones, with byte-exact golden files for Replika, Kindroid and Claude.

A complete release check also requires manual exports from an authenticated Replika web account, a Kindroid account and a Claude account.

## Project Structure

```text
extension/     Chrome extension source
tests/         Automated tests
docs/replika/  Replika guides and visual workflow
docs/kindroid/ Kindroid guides
docs/claude/   Claude guides
```
