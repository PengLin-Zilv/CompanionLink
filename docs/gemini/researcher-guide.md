# Researcher Guide: Gemini

> This guide covers Gemini; see the [Replika](../replika/researcher-guide.md), [Kindroid](../kindroid/researcher-guide.md), [Claude](../claude/researcher-guide.md) and [ChatGPT](../chatgpt/researcher-guide.md) researcher guides for those apps. The extension reads the chat open in the participant's gemini.google.com tab, using the Google sign-in already in their browser, and downloads the CSV to their computer.

## Before Each Participant Session

Prepare the same four items as for Replika: the Chrome Web Store link, the participant's Participant ID, the From and To dates, and the file-submission instructions. Date rules and time columns are the same as for Replika (see the Replika researcher guide: [dates](../replika/researcher-guide.md#before-each-participant-session) and [time columns](../replika/researcher-guide.md#time-columns)).

## Install And Verify

1. Install CompanionLink from the study's Chrome Web Store link.
2. Sign in to [gemini.google.com](https://gemini.google.com) with a test account and open a chat.
3. Open **CompanionLink**, enter a test Participant ID and a short date range.
4. Click **Export Chat Log** and confirm that `P<Participant ID>.csv` downloads.

Repeat after an extension update or a major Gemini website change. CompanionLink reads the chat through the requests Gemini's own website makes, which are undocumented and can change without notice.

## One Chat Per File

Participants export each chat they want to share, one file per chat. Chrome names the files `P040.csv`, `P040 (1).csv`, `P040 (2).csv`, and so on.

## What The CSV Contains

The seven columns, file name, encoding and time columns are the same as for Replika. Gemini differs in these columns:

| Column | Gemini value |
| --- | --- |
| `From` | `Me` for the participant, `Gemini` for Gemini |
| `Text` | The text of the message, line breaks included |
| `Reaction` | `N/A` for every row: Gemini's thumbs up/down ratings are not exported |

Things to know when analyzing:

- **A prompt and its reply share one time.** Gemini keeps one time for each prompt and its reply, so both rows have the same timestamps, with the reply directly above its prompt. The time between a prompt and its reply cannot be measured. Whether the time marks the prompt or the finished reply has not been confirmed.
- **Cards appear as placeholder links.** Product, map, hotel, video, generated-image and similar cards in a reply appear in `Text` as links such as `http://googleusercontent.com/shopping_content/0`. The card's content is not exported.
- **Text only.** Files and images the participant uploaded are not exported. A prompt with only an upload has empty `Text`.
- **Regenerated replies.** Gemini keeps other drafts of a reply, but the file has only the draft the chat currently shows.
- **Each message counts by its own time.** A chat begun before the From date contributes its messages from inside the dates.
- **Chats with a Gem, or under a second signed-in Google account** (address `gemini.google.com/u/1/...`), export the same way.
- **Some replies stop the export.** A reply without text, or with a kind of card CompanionLink does not read, stops the export with "Gemini returned a kind of message CompanionLink cannot export yet..." instead of leaving words out.

Gemini export reads 10 prompts and replies per request, one second apart, from the newest back to the From date. A long chat can take a minute or more; the participant keeps the extension window open.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "Open Replika, a one-to-one Kindroid chat, a Claude chat, a ChatGPT chat or a Gemini chat in this tab..." | Open the chat itself from the list of chats, not the Gemini home page, a Gem's page or a shared link, and reopen the extension. |
| "Sign in to Gemini in this tab, refresh the page, then try again." | Sign in to Gemini in the same tab and refresh. If it repeats after a refresh, record the message: Gemini may have changed its website. |
| "Gemini has not finished its last reply in this chat..." | Wait for the reply to finish. If it stopped, regenerate it in Gemini, then export again. |
| "Gemini is limiting requests..." | Wait a few minutes and export again. |
| "Could not read from Gemini..." or "Could not read the Gemini tab..." | Check the internet connection, refresh the Gemini page and try again. |
| "Gemini returned a kind of message CompanionLink cannot export yet..." | Record the message and the chat's dates: the extension needs an update for this kind of reply. |
| "Gemini returned an unexpected response", "an incomplete chat", "an invalid chat message" or "an error (HTTP ...)" | Retry once. If it repeats, record the exact message: Gemini may have changed its website, and the extension may need an update. |
| "0 messages exported" | Check the chat and the dates; dates with no messages give a file with only the column names. |
| The extension closed before the download | Export again; nothing partial is saved. |
