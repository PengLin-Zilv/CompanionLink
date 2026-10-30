# CompanionLink

CompanionLink is a Chrome extension for collecting conversation data, with participants' consent, in studies of human–AI interaction. Participants use it to export their own chat history with a conversational AI app, for the dates a study sets, into one consistent CSV format. The export runs entirely in the participant's browser: nothing is sent to the researchers or to any server, and participants share the file through the study's own procedure.

Chat apps' own exports, where they exist, rarely suit research: they may cover a whole account, cannot be limited to study dates, or differ in format from app to app. CompanionLink gives every participant the same steps and every study the same columns, with each message's time in the participant's time zone and in UTC. It currently supports Replika, Kindroid and Claude; each app has its own connector, while the output format, date handling and privacy model are shared.

## Supported Apps

| App | What the participant opens | What the file contains |
| --- | --- | --- |
| Replika | [my.replika.com](https://my.replika.com) | Text messages and reactions |
| Kindroid | A one-to-one chat with their Kin on [kindroid.ai](https://kindroid.ai), plus their own Kindroid API key | Text messages |
| Claude | The chat they are sharing on [claude.ai](https://claude.ai) (one chat per file) | Text messages |

Images, voice messages, attachments and other app data, such as memories or profiles, are not exported. A message that was only an image keeps its row, with empty text.

Replika and Kindroid are in the current Chrome Web Store version (0.2.1). Claude arrives in version 0.3.0.

## Install

Participants install CompanionLink in Google Chrome on a computer, from its [Chrome Web Store page](https://chromewebstore.google.com/detail/companionlink/eopfeddgggnpngombnnabadjoaadikkh): click **Add to Chrome**, then **Add extension**.

## How A Participant Exports

1. Open the app in Chrome and sign in.
2. Open **CompanionLink** from Chrome's Extensions menu.
3. Enter the Participant ID and the From and To dates. For Kindroid, also paste the Kindroid API key.
4. Click **Export Chat Log**. The file downloads as `P<Participant ID>.csv`, for example `P040.csv`.

## Dates

- Both dates are included.
- Dates are calendar days in each participant's own computer time zone, detected automatically.
- If the To date is today, the export includes messages up to the moment the participant clicks **Export Chat Log**.

## What The File Contains

One row per message, newest first, in eight columns:

| Column | Meaning |
| --- | --- |
| `Timestamp_Local` | Time in the participant's time zone |
| `Local_Timezone` | That time zone, such as `America/Los_Angeles` |
| `Timestamp_UTC` | The exact time in UTC; use it to match messages to study events and to measure time between messages |
| `Timestamp_Eastern` | The same time in US Eastern Time |
| `From` | `Me` for the participant; `Rep`, `Kin` or `Claude` for the companion |
| `Text` | The message as written, line breaks included |
| `Reaction` | Replika's reaction, or `None`; `N/A` for Kindroid and Claude (not available) |
| `ID` | The message's ID in the app |

The file opens correctly in Excel. In R, read it with `fileEncoding = "UTF-8-BOM"`; in Python, open it with `open(path, encoding="utf-8-sig", newline="")`. Dates with no messages give a file with only the column names.

## Privacy

- The extension runs only in the participant's browser, and exports only when they click **Export Chat Log**.
- It reads the participant's own chat with their existing sign-in (Replika and Claude) or with the API key they paste (Kindroid). It never asks for a password and never saves the key. For Replika, the sign-in is picked up when the Replika page loads.
- The only output is the CSV on the participant's computer. Nothing is sent to the research team, the developers or any other server.

See the full [privacy policy](https://penglin-zilv.github.io/companion-chat-log-export-privacy/).

## Limits To Plan For

- **Website changes.** Replika and Claude are read through each app's own website, not an official API, so a website change can stop exports until the extension is updated. The extension then shows an error and saves nothing, never a partial file. Kindroid uses its official API.
- **Export time.** Kindroid limits how fast data can be requested, so long histories pause and can take several minutes. Participants keep the extension window open until the file downloads.
- **One Claude chat per file.** Participants choose which Claude chats to share; your protocol should say which chats count.
- **Terms and ethics.** Review each app's terms and your ethics board's requirements before using CompanionLink in a study.

## Guides

| App | For participants | For researchers |
| --- | --- | --- |
| Replika | [Participant instructions](docs/replika/participant-guide.md) | [Researcher guide](docs/replika/researcher-guide.md) |
| Kindroid | [Participant instructions](docs/kindroid/participant-guide.md) | [Researcher guide](docs/kindroid/researcher-guide.md) |
| Claude (draft for 0.3.0) | [Participant instructions](docs/claude/participant-guide.md) | [Researcher guide](docs/claude/researcher-guide.md) |

## Technical Details

How each export works and when it stops, browser permissions, the exact CSV format, development and releases: [docs/technical-notes.md](docs/technical-notes.md).
