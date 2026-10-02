# Researcher Guide

> Draft for the expected Chrome Web Store release. This version supports Replika and downloads the chat log to the participant's computer.

## Before Each Participant Session

Prepare these four items:

- the study's Chrome Web Store link;
- the participant's assigned Participant ID;
- the From date and To date;
- the study's file-submission instructions.

Both dates are included and use the participant's computer time zone, detected when they click **Export Chat Log**. The same dates refer to each participant's own local days, not one shared global interval. If the To date is today, the export includes messages through the time they click the button.

## Install And Verify

Before using the extension in a study:

1. Open the study's Chrome Web Store link in Chrome.
2. Click **Add to Chrome**, then confirm **Add extension**.
3. Go to [my.replika.com](https://my.replika.com) and sign in with a test account.
4. Refresh the Replika tab.
5. Open **CompanionLink** from Chrome's Extensions menu.
6. Enter a test Participant ID and a short date range.
7. Click **Export Chat Log**.
8. Confirm that Chrome downloads a file named `P<Participant ID>.csv`.

Repeat this check after an extension update or a major Replika website change.

## Information To Give Participants

Send each participant:

- the Chrome Web Store link;
- their exact Participant ID;
- the exact From date and To date;
- the instructions for submitting the downloaded file.

Participant IDs may contain letters, numbers, underscores, or hyphens. Entering `040` produces `P040.csv`.

## Confirm A Successful Export

A successful export shows:

- `Downloaded P<Participant ID>.csv` in the extension;
- the number of messages exported;
- the CSV file in Chrome's Downloads folder.

Open the file and confirm that it contains the expected date range. A file with zero messages may be valid, but first confirm the participant used the correct account and dates.

## Time Columns

- `Timestamp_Local`: message time in the detected computer time zone.
- `Local_Timezone`: the detected zone, such as `America/Los_Angeles`.
- `Timestamp_UTC`: the precise time reference for matching study prompts and calculating elapsed time.
- `Timestamp_Eastern`: the corresponding Eastern Time for the team's reference.

The remaining columns are `From,Text,Reaction,ID`. Rows are newest first.
Update analysis scripts that expect the old five-column CSV: `Timestamp_Eastern`
replaces the former `Timestamp` column. The legacy Python script has not changed.

All local timestamps use the time zone detected at export, with daylight-saving
rules applied at each message's date. They do not establish where the participant
was at the time. Agree on how the study handles travel or changed time-zone settings.
Use UTC to distinguish repeated clock times when daylight saving time ends.

## Troubleshooting

### "Open Replika in the active tab before exporting."

Make sure the active tab's address is my.replika.com. The extension works only on Replika's chat site, not on replika.com or other Replika pages. Confirm the participant is signed in, and try again without switching tabs.

### "No active Replika tab found."

Open my.replika.com in Chrome, then reopen the extension.

### "Replika session was not captured."

Refresh the Replika tab, wait for the chat to finish loading, then try again.

### Participant ID or date error

Re-enter the Participant ID and both dates exactly as assigned. The From date cannot be after the To date, and the To date cannot be in the future.

### Connection or Replika error

Confirm the internet connection, refresh Replika, and retry once. If the same error returns, record the exact message and stop repeated attempts.

### No file downloads

Check Chrome's Downloads page and any download warning. Keep the extension open until it displays `Downloaded P<Participant ID>.csv`.

### Export is interrupted

Reopen the extension, re-enter the same information, and export again. The interrupted attempt does not change the Replika account.
