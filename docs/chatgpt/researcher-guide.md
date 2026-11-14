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
| `Text` | The message as written; voice messages give their transcript |
| `Reaction` | `N/A` for every row |

- **Text only.** Images, files, canvas, tool use and reasoning are not exported. A message with only an attachment has empty `Text`.
- **Only the version on screen.** Edited messages and regenerated replies keep only the version the chat shows.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "Open Replika, a one-to-one Kindroid chat, a Claude chat, a ChatGPT chat or a Gemini chat in this tab..." | Open the chat itself (address `chatgpt.com/c/...`) and reopen the extension. |
| "Sign in to ChatGPT in this tab, refresh the page, then try again." | Sign in to ChatGPT in the same tab and refresh. |
| "ChatGPT has not finished its last reply in this chat..." | Wait for the reply to finish, then export again. |
| "ChatGPT could not find this chat..." | Open the chat from ChatGPT's sidebar. |
| "ChatGPT is limiting requests..." | Wait a few minutes and export again. |
| Any other error | Refresh the ChatGPT page and try once more. If it repeats, record the exact message: the extension may need an update. |
