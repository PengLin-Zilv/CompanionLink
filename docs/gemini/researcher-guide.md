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
| `Text` | The message as written |
| `Reaction` | `N/A` for every row |

- **A prompt and its reply share one time.** Both rows have the same timestamps, with the reply directly above its prompt.
- **Text only.** Uploaded files and images are not exported. Cards in a reply (products, maps, images and similar) appear as placeholder links.
- **Only the draft on screen.** Regenerated replies keep only the draft the chat shows.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "Open Replika, a one-to-one Kindroid chat, a Claude chat, a ChatGPT chat or a Gemini chat in this tab..." | Open the chat itself from the list of chats and reopen the extension. |
| "Sign in to Gemini in this tab, refresh the page, then try again." | Sign in to Gemini in the same tab and refresh. |
| "Gemini has not finished its last reply in this chat..." | Wait for the reply to finish, then export again. |
| "Gemini is limiting requests..." | Wait a few minutes and export again. |
| Any other error | Refresh the Gemini page and try once more. If it repeats, record the exact message: the extension may need an update. |
