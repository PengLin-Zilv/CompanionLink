# Researcher Guide: Kindroid

> This guide covers Kindroid; see the [Replika](../replika/researcher-guide.md) and [Claude](../claude/researcher-guide.md) researcher guides for those apps. The extension reads the participant's chat through Kindroid's official API with the participant's own API key and downloads the CSV to their computer.

## Before Each Participant Session

Prepare the same four items as for Replika: the Chrome Web Store link, the participant's Participant ID, the From and To dates, and the file-submission instructions. Date rules and time columns are the same as for Replika (see the Replika researcher guide: [dates](../replika/researcher-guide.md#before-each-participant-session) and [time columns](../replika/researcher-guide.md#time-columns)).

## Install And Verify

1. Install CompanionLink from the study's Chrome Web Store link.
2. Sign in to [kindroid.ai](https://kindroid.ai) with a test account and open a one-to-one chat with a Kin.
3. Open **CompanionLink**, enter a test Participant ID, a short date range and the test account's API key.
4. Click **Export Chat Log** and confirm that `P<Participant ID>.csv` downloads.

Repeat after an extension update or a major Kindroid change.

## The API Key

- Participants enter their own key for each export. It is sent only to Kindroid, never saved, and cleared when an export finishes or fails. After a Participant ID, date or key-format error it stays in the box so it can be corrected.
- The key gives full access to the participant's Kindroid account. Participants should never send it to the research team. If a participant sends you their key, delete it and ask them to regenerate it.
- Regenerating the key in Kindroid's settings stops the old key at once; any other app that uses the key then needs the new one, and so does the next export. Whether to advise participants to regenerate their key after exporting is a team decision.

## What The CSV Contains

The eight columns, file name, encoding and time columns are the same as for Replika. Kindroid differs in two columns:

| Column | Kindroid value |
| --- | --- |
| `From` | `Me` for the participant, `Kin` for the Kin |
| `Reaction` | `N/A` for every row: Kindroid's API does not return reactions. (`None` would claim no reaction was given.) |

As for Replika, `Text` is the message as written, line breaks included, and empty for an image-only message.

Things to know when analyzing:

- **Kindroid server errors appear as Kin rows.** Kindroid keeps its own server-error replies in the history as Kin messages whose `Text` starts with `<<ERROR>>` (observed in testing, not documented). They are not the Kin's words and inflate Kin message counts. The team should decide whether to exclude them.
- **An export is a snapshot.** Tweak and Regenerate replace a message's text but keep its ID and original time, and Rewind deletes messages. The file shows the chat as it was on the day of export; earlier wording cannot be recovered.
- **Only one-to-one chats.** Group chats and Rooms are not supported. A participant with several Kins exports the chat open in the tab. The success message usually names the Kin (from the chat's first message) but can omit it.

## Export Time

Kindroid allows 10 requests every 30 seconds per account, and one request returns up to 100 messages. The extension paces its requests, so an export of more than about 800 messages in the selected dates pauses for about 30 seconds after every 9 requests. Rough durations: 2,800 messages about 2 minutes; 8,400 about 5 minutes; 25,000 about 15 minutes. The participant must keep the extension window open throughout.

Kindroid also allows 600 requests per account per day, shared with other apps that use the key and with failed attempts. A date range with more than about 59,000 messages cannot be exported in one go (the export stops at the limit and saves nothing); split it into shorter ranges exported on different days.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "Open Replika, a one-to-one Kindroid chat or a Claude chat in this tab..." | Open the one-to-one chat with the Kin (not a group chat) and reopen the extension. |
| "Paste your Kindroid API key. It starts with kn_." | Clear the key box and paste the key again, without spaces. |
| "Kindroid did not accept this API key..." | Copy the current key; a regenerated key replaces the old one. |
| "No messages found for this Kindroid chat..." | Check that the right chat is open. |
| "Kindroid is limiting requests..." | Wait a minute, paste the key again and export again. Common after closing the extension mid-export and restarting at once. |
| "Could not reach Kindroid..." | Check the internet connection and try again. |
| "Kindroid did not respond in time" or "Kindroid is not responding" | Retry later; record the message if it repeats. |
| "0 messages exported" | Check the chat and the dates; dates with no messages give a file with only the column names. |
| The extension closed before the download | Export again from the start, with the key pasted again; nothing partial is saved. |
