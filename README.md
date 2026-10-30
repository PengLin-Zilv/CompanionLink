# CompanionLink

CompanionLink is a Chrome extension for collecting conversation data, with participants' consent, in studies of human–AI interaction. Participants use it to export their own chat history with a conversational AI app, for the dates a study sets, into one consistent CSV format. The CSV is produced in the participant's browser and is not uploaded. Participants share the file through the study's own procedure. Reading the history contacts the companion app they are already using; see [Privacy](#privacy).

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

## Install From Source

Study participants should use the Chrome Web Store link above. This section is for running the code in this repository.

There is no compile step and there are no package dependencies. The Web Store package is the `extension` directory, with `manifest.json` at the root of the zip.

1. Install Google Chrome. Install Node.js 22.6 or newer only if you want to run the tests. The extension itself does not need Node.
2. Clone this repository.
3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `extension` folder.
4. Refresh any open my.replika.com tab before a Replika export.

The folder includes the Claude connector. `extension/manifest.json` in this tree is still version 0.2.1, and that version's description names Replika and Kindroid. The Web Store package at 0.2.1 does not include Claude.

To pack the same folder the way the Web Store receives it:

```bash
cd extension
zip -r ../companionlink-extension.zip .
```

From the repository root, run the tests with:

```bash
npm test
```

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

The CSV is built in the participant's browser and saved on their computer. The extension does not upload that file to the research team or to the people who develop CompanionLink.

A file is downloaded only after the participant clicks **Export Chat Log**. A failed export downloads nothing.

Fetching the messages does contact the companion app the participant is already using. That is how the history is read. It is separate from the CSV file:

- **Replika.** When a my.replika.com page loads, a content script picks up the sign-in the page already has and holds it in memory. The click then requests history from Replika at `wss://ws.replika.ai/v17`. The sign-in is not written into the CSV. The extension never asks for a Replika password.
- **Kindroid.** The participant pastes their own Kindroid API key. The extension sends that key only to Kindroid (`https://api.kindroid.ai/v1/get-chat-messages`) and clears the field when the attempt ends. The key is not stored.
- **Claude.** The click runs the request inside the open claude.ai tab. The browser attaches the Claude sign-in that is already there. The extension does not read that sign-in.

Replika export uses the account signed in on that tab. Kindroid and Claude export the one chat open on that tab. In each case the file is limited to the dates the participant entered.

See the full [privacy policy](https://penglin-zilv.github.io/companion-chat-log-export-privacy/).

## Permissions

`extension/manifest.json` (version 0.2.1) requests two API permissions and one site script. It has no `host_permissions` list.

| Permission | What it allows | When it runs |
| --- | --- | --- |
| `activeTab` | Read the address of the tab where the participant opened CompanionLink, so the popup can tell Replika, Kindroid, and Claude apart. Access is limited to that tab. | When the participant opens the extension |
| `scripting` | Install the Replika content script if it is missing, and run the Claude request inside the open claude.ai tab. | Replika: when an export starts. Claude: only after **Export Chat Log** |
| Content script on `https://my.replika.com/*` | Run `contentScript.js` at the start of a Replika page load, and expose `pageBridge.js` only to that site, so the existing sign-in can be picked up. | When my.replika.com loads |

The manifest does not request storage or the downloads API, and it does not install a content script on Kindroid or Claude.

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

## License

This repository does not grant a license yet. Do not copy, modify, or redistribute the code as open source until the maintainers add a `LICENSE` file.

The copyright holder and the license still need confirmation from the author, the advisor, and the institution. Three OSI-approved licenses are the ones to take into that conversation:

- **MIT.** Short and widely recognized, including by JOSS. It has no explicit patent grant.
- **Apache-2.0.** Also recognized by JOSS. It adds an explicit patent grant and a change-notice convention, and it is longer to apply.
- **BSD-3-Clause.** Recognized by JOSS, and named by PLOS among suitable software licenses. Its no-endorsement clause limits use of the copyright holder's name to promote a derivative.

Choose GPL-3.0 only if the copyright holder wants derivative works to stay under the same license. Use a Creative Commons license for a paper about the software. The code needs a software license.

## Project

- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security](SECURITY.md)
- [Citation metadata](CITATION.cff). Affiliation, ORCID, and the public contact email are still placeholders.
- [JOSS draft](paper/paper.md). It is a skeleton with open questions, not a submission.
