# Researcher Guide: Claude

> This guide covers Claude; see the [Replika](../replika/researcher-guide.md) and [Kindroid](../kindroid/researcher-guide.md) researcher guides for those apps. Draft for version 0.3.0. The extension reads the chat open in the participant's claude.ai tab, using the sign-in already in their browser, and downloads the CSV to their computer.

## Before Each Participant Session

Prepare the same four items as for Replika: the Chrome Web Store link, the participant's Participant ID, the From and To dates, and the file-submission instructions. Date rules and time columns are the same as for Replika (see the Replika researcher guide: [dates](../replika/researcher-guide.md#before-each-participant-session) and [time columns](../replika/researcher-guide.md#time-columns)).

## Install And Verify

1. Install CompanionLink from the study's Chrome Web Store link.
2. Sign in to [claude.ai](https://claude.ai) with a test account and open a chat.
3. Open **CompanionLink**, enter a test Participant ID and a short date range.
4. Click **Export Chat Log** and confirm that `P<Participant ID>.csv` downloads.

Repeat after an extension update or a major Claude website change. CompanionLink reads the chat through the requests Claude's own website makes, which are undocumented and can change without notice.

## One Chat Per File

- The extension exports only the chat open in the tab, so participants share chats one at a time. Claude is a general-purpose assistant, and participants may hold work, health or other private chats. Define in your protocol which Claude chats count (for example, all chats in the dates, or only companion-style chats), and tell participants they may withhold any chat.
- Participants export each chat they share. Chrome names the files `P040.csv`, `P040 (1).csv`, `P040 (2).csv`, and so on.
- A file does not say which chat it came from. The participant guide asks participants to submit every file and say how many chats they exported. A missing chat cannot be detected from the files.
- Message IDs are unique across chats. To combine one participant's files, keep each file's name with its rows (each file is one chat), drop repeated IDs (a chat exported twice) and sort by `Timestamp_UTC`.

## What The CSV Contains

The eight columns, file name, encoding and time columns are the same as for Replika. Claude differs in these columns:

| Column | Claude value |
| --- | --- |
| `From` | `Me` for the participant, `Claude` for Claude |
| `Text` | The text of the message, line breaks included |
| `Reaction` | `N/A` for every row: Claude's thumbs up/down ratings are not exported |
| `ID` | The message's ID in Claude |

Things to know when analyzing:

- **Text only.** Files and images the participant attached, artifacts, web searches and other tool use, citation links, and Claude's thinking are not exported. A message with only an attachment has empty `Text`.
- **Only the version on screen.** Editing a message or regenerating a reply keeps the older versions in Claude. The file contains only the versions shown on screen at the time of export.
- **Each message counts by its own time.** A chat begun before the From date contributes its messages from inside the dates.
- **A reply's time is when Claude finished it.** The gap between a `Me` row and the next `Claude` row includes the time Claude took to write.
- **A reply ended with Claude's Stop button** is exported as far as it got, with no marker.
- **Chats inside a Claude Project** export the same way.

A Claude export usually takes a few seconds; it needs no pacing, unlike Kindroid.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "Open Replika, a one-to-one Kindroid chat or a Claude chat in this tab..." | Open the chat itself (address `claude.ai/chat/...`), not a new chat, the chat list, a project page or a shared link, and reopen the extension. |
| "Sign in to Claude in this tab, refresh the page, then try again." | Sign in to Claude in the same tab and refresh. |
| "Claude has not finished its last reply in this chat..." | Wait for the reply to finish. If it stopped with an error, click Retry in Claude, then export again. |
| "Claude could not find this chat..." | Open the chat from Claude's sidebar. The participant may be signed in to a different account, or the chat was deleted. |
| "Claude is limiting requests..." | Wait a few minutes and export again. |
| "Could not read from Claude..." or "Could not read the Claude tab..." | Check the internet connection, refresh the Claude page and try again. |
| "Claude returned an unexpected response", "an incomplete chat", "an invalid chat message" or "an error (HTTP ...)" | Retry once. If it repeats, record the exact message: Claude may have changed its website, and the extension may need an update. |
| "0 messages exported" | Check the chat and the dates; an empty range gives a header-only file. |
| The extension closed before the download | Export again; nothing partial is saved. |
