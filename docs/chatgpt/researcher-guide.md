# Researcher Guide: ChatGPT

> This guide covers ChatGPT; see the [Replika](../replika/researcher-guide.md), [Kindroid](../kindroid/researcher-guide.md), [Claude](../claude/researcher-guide.md) and [Gemini](../gemini/researcher-guide.md) researcher guides for those apps. The extension reads the chat open in the participant's chatgpt.com tab, using the sign-in already in their browser, and downloads the CSV to their computer.

## Before Each Participant Session

Prepare the same four items as for Replika: the Chrome Web Store link, the participant's Participant ID, the From and To dates, and the file-submission instructions. Date rules and time columns are the same as for Replika (see the Replika researcher guide: [dates](../replika/researcher-guide.md#before-each-participant-session) and [time columns](../replika/researcher-guide.md#time-columns)).

## Install And Verify

1. Install CompanionLink from the study's Chrome Web Store link.
2. Sign in to [chatgpt.com](https://chatgpt.com) with a test account and open a chat.
3. Open **CompanionLink**, enter a test Participant ID and a short date range.
4. Click **Export Chat Log** and confirm that `P<Participant ID>.csv` downloads.

Repeat after an extension update or a major ChatGPT website change. CompanionLink reads the chat through the requests ChatGPT's own website makes, which are undocumented and can change without notice.

## One Chat Per File

Participants export each chat they want to share, one file per chat. Chrome names the files `P040.csv`, `P040 (1).csv`, `P040 (2).csv`, and so on.

## What The CSV Contains

The seven columns, file name, encoding and time columns are the same as for Replika. ChatGPT differs in these columns:

| Column | ChatGPT value |
| --- | --- |
| `From` | `Me` for the participant, `ChatGPT` for ChatGPT |
| `Text` | The text of the message, line breaks included; voice messages give their transcript |
| `Reaction` | `N/A` for every row: ChatGPT's thumbs up/down ratings are not exported |

Things to know when analyzing:

- **Text only.** Images and files, canvas documents, generated images, web searches and other tool use, ChatGPT's reasoning and memory updates are not exported. A participant message with only an attachment has empty `Text`.
- **Edited messages and regenerated replies.** The file has only the version the chat currently shows.
- **Each message counts by its own time.** A chat begun before the From date contributes its messages from inside the dates.
- **Rows follow the chat's order, newest first.** ChatGPT's times can be out of that order by a few seconds; sort by `Timestamp_UTC` if you need strict time order.
- **A reply's time is the time ChatGPT records for it.** Whether that is when the reply started or finished has not been confirmed, so treat the gap between a `Me` row and the next `ChatGPT` row with care.
- **Chats with a GPT or inside a project** export the same way.
- **A new kind of message stops the export.** If ChatGPT shows a kind of message with text that CompanionLink does not know, it stops with "ChatGPT returned a kind of message CompanionLink cannot export yet..." instead of leaving the text out.

ChatGPT export reads 100 messages per request, from the newest back to a day before the From date. A long chat can take a minute or more; the participant keeps the extension window open.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "Open Replika, a one-to-one Kindroid chat, a Claude chat, a ChatGPT chat or a Gemini chat in this tab..." | Open the chat itself (address `chatgpt.com/c/...`), not the home page, a temporary chat, a GPT's page, a project page or a shared link, and reopen the extension. |
| "Sign in to ChatGPT in this tab, refresh the page, then try again." | Sign in to ChatGPT in the same tab and refresh. |
| "ChatGPT has not finished its last reply in this chat..." | Wait for the reply to finish. If it stopped with an error, click Try again on the reply, then export again. |
| "ChatGPT could not find this chat..." | Open the chat from ChatGPT's sidebar. The participant may be signed in to a different account, or the chat was deleted. |
| "ChatGPT is limiting requests..." | Wait a few minutes and export again. |
| "Could not read from ChatGPT..." or "Could not read the ChatGPT tab..." | Check the internet connection, refresh the ChatGPT page and try again. |
| "ChatGPT returned a kind of message CompanionLink cannot export yet..." | Record the message and the chat's dates: the extension needs an update for this kind of message. |
| "ChatGPT returned an unexpected response", "an incomplete chat", "an invalid chat message" or "an error (HTTP ...)" | Retry once. If it repeats, record the exact message: ChatGPT may have changed its website, and the extension may need an update. |
| "0 messages exported" | Check the chat and the dates; dates with no messages give a file with only the column names. |
| The extension closed before the download | Export again; nothing partial is saved. |
